"""ASR 사이드카 서버: 마이크 캡처 → 어댑터 추론 → WebSocket 브로드캐스트.

실행 예:
  python asr_server.py --adapter gemini_live ^
    --model-id gemini-3.5-transcribe-live ^
    --language ko-KR --api-key <키> --device default --port 0

- 포트가 0이면 OS가 동적 할당 → 실제 포트를 stdout에 `PORT=<n>` 한 줄로 출력
  (WPF SidecarService가 이 줄을 파싱한다. 로그는 전부 stderr로!)
- WS 스키마: {type:partial|final, text}, {type:status, state, detail}
- 클라이언트→서버: {type:listen, active:bool}, {type:reset}, {type:set_device, device}
- 테스트: --input-wav sample.wav [--input-loop] 로 마이크 대신 파일 재생
- 고아 방지: --parent-pid 지정 시 부모가 죽으면 2초 내 자살한다.
  (정상 종료는 WS close/프로세스 kill, 비정상 종료·부모 크래시는 워치독)
"""
from __future__ import annotations

import argparse
import asyncio
import importlib
import inspect
import json
import os
import queue
import sys
import threading
import time
import traceback

import numpy as np

from adapters.base import AsrAdapter

_SR = 16_000


def _parent_alive(_pid: int) -> bool:
    """부모 프로세스 생존 확인. 확인할 수 없으면 살아있다고 본다."""
    if _pid <= 0:
        return True
    try:
        if sys.platform == "win32":
            import ctypes
            handle = ctypes.windll.kernel32.OpenProcess(0x00100000, False, _pid)
            if not handle:
                return False
            ctypes.windll.kernel32.CloseHandle(handle)
            return True
        os.kill(_pid, 0)
        return True
    except Exception:
        return True


def _parent_watchdog(_pid: int) -> None:
    """부모가 죽으면 프로세스 전체를 즉시 끝낸다. 고아 사이드카 방지."""
    if _pid <= 0:
        return
    while True:
        time.sleep(2.0)
        if not _parent_alive(_pid):
            os._exit(0)


def load_adapter(name: str) -> AsrAdapter:
    try:
        mod = importlib.import_module(f"adapters.{name}")
    except ModuleNotFoundError as e:
        raise RuntimeError(
            f"어댑터 모듈 없음: adapters/{name}.py ({e})"
        ) from e
    for _, obj in inspect.getmembers(mod, inspect.isclass):
        if issubclass(obj, AsrAdapter) and obj is not AsrAdapter:
            return obj()
    raise RuntimeError(f"adapters/{name}.py 안에 AsrAdapter 서브클래스가 없습니다.")


class Server:
    def __init__(self, adapter: AsrAdapter, device: str,
                 input_wav: str = "", input_loop: bool = False) -> None:
        self.adapter = adapter
        self.device = device
        self.input_wav = input_wav
        self.input_loop = input_loop
        self.listening = False
        self.clients: set = set()
        self.loop: asyncio.AbstractEventLoop | None = None
        self._mic_thread: threading.Thread | None = None
        self._mic_stop = threading.Event()

    async def broadcast(self, msg: dict) -> None:
        data = json.dumps(msg, ensure_ascii=False)
        dead = []
        for ws in list(self.clients):
            try:
                await ws.send(data)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.clients.discard(ws)

    def broadcast_sync(self, msg: dict) -> None:
        if self.loop is None:
            return
        asyncio.run_coroutine_threadsafe(self.broadcast(msg), self.loop)

    # -- 입력 -------------------------------------------------------------
    def start_mic(self) -> None:
        self.stop_mic()
        self._mic_stop.clear()
        self._mic_thread = threading.Thread(target=self._mic_loop, daemon=True)
        self._mic_thread.start()

    def stop_mic(self) -> None:
        self._mic_stop.set()
        if self._mic_thread is not None:
            self._mic_thread.join(timeout=3)
            self._mic_thread = None

    def _mic_loop(self) -> None:
        if self.input_wav:
            self._wav_loop()
            return
        try:
            import sounddevice as sd
        except ImportError:
            self.broadcast_sync({"type": "status", "state": "error",
                                 "detail": "sounddevice 미설치. pip install sounddevice"})
            return
        dev = self._resolve_device()

        def cb(indata, frames, t, status):
            # dictate.py와 동일하게 콜백에서 직접 전달 (중간 큐 없이 100ms 청크)
            if self.listening:
                try:
                    self.adapter.feed(bytes(indata))
                except Exception:
                    pass

        try:
            with sd.RawInputStream(samplerate=_SR, channels=1, dtype="int16",
                                   device=dev, blocksize=_SR // 10, callback=cb):
                self.broadcast_sync({"type": "status", "state": "listening"
                                     if self.listening else "ready"})
                while not self._mic_stop.is_set():
                    self._mic_stop.wait(0.2)
        except Exception as e:
            self.broadcast_sync({"type": "status", "state": "error",
                                 "detail": f"마이크 열기 실패: {e}"})

    def _resolve_device(self):
        """device 문자열 → sounddevice 장치. "name:<표시명>" 부분일치 지원."""
        dev = None if self.device in ("", "default") else self.device
        if isinstance(dev, str) and dev.startswith("name:"):
            return self._resolve_device_by_name(dev[len("name:"):])
        if isinstance(dev, str) and dev not in (None, ""):
            try:
                return int(dev)
            except ValueError:
                pass
        return dev

    @staticmethod
    def _resolve_device_by_name(name: str):
        try:
            import sounddevice as sd

            for i, d in enumerate(sd.query_devices()):
                if d["max_input_channels"] > 0 and name.lower() in d["name"].lower():
                    print(f"mic matched: [{i}] {d['name']}", file=sys.stderr)
                    return i
            print(f"mic name not found: {name!r}, using default", file=sys.stderr)
        except Exception as e:
            print(f"mic lookup failed: {e}", file=sys.stderr)
        return None

    def _wav_loop(self) -> None:
        """테스트 모드: 마이크 대신 wav 파일을 실시간 속도로 재생해 feed한다."""
        import time

        try:
            import soundfile as sf
        except ImportError:
            # soundfile 없이 wave 모듈로 16k mono int16만 지원
            sf = None
        try:
            if sf is not None:
                audio, sr = sf.read(self.input_wav, dtype="float32", always_2d=True)
                audio = audio.mean(axis=1)
                if sr != _SR:
                    import librosa

                    audio = librosa.resample(audio, orig_sr=sr, target_sr=_SR)
                pcm = (audio * 32768.0).clip(-32768, 32767).astype("<i2").tobytes()
            else:
                import wave

                with wave.open(self.input_wav, "rb") as wf:
                    assert wf.getnchannels() == 1 and wf.getsampwidth() == 2
                    assert wf.getframerate() == _SR
                    pcm = wf.readframes(wf.getnframes())
        except Exception as e:
            self.broadcast_sync({"type": "status", "state": "error",
                                 "detail": f"wav 읽기 실패: {e}"})
            return
        step = _SR // 5 * 2  # 200ms씩
        while not self._mic_stop.is_set():
            for off in range(0, len(pcm), step):
                if self._mic_stop.is_set():
                    break
                # listen 전에는 소비하지 않고 대기 (안 그러면 파일이 사라진다)
                while not self.listening and not self._mic_stop.is_set():
                    time.sleep(0.1)
                if self._mic_stop.is_set():
                    break
                try:
                    self.adapter.feed(pcm[off: off + step])
                except Exception:
                    pass
                time.sleep(0.2)
            if not self.input_loop:
                break

    async def poll_loop(self) -> None:
        while True:
            await asyncio.sleep(0.05)
            try:
                events = self.adapter.poll()
            except Exception as e:
                await self.broadcast({"type": "status", "state": "error",
                                      "detail": f"poll 실패: {e}"})
                continue
            for ev in events:
                if ev.kind in ("partial", "final"):
                    await self.broadcast({"type": ev.kind, "text": ev.text})
                elif ev.kind == "__connected__":
                    await self.broadcast({"type": "status", "state": "connected",
                                          "detail": ev.text})
                elif ev.kind == "__disconnected__":
                    await self.broadcast({"type": "status", "state": "disconnected",
                                          "detail": ev.text})
                else:
                    # 어댑터 내부 상태 보고(__status__ 등) → status/error로 전달
                    await self.broadcast({"type": "status", "state": "error",
                                          "detail": ev.text})

    async def handler(self, ws) -> None:
        self.clients.add(ws)
        print(f"ws conn: client connected (total={len(self.clients)})",
              file=sys.stderr, flush=True)
        try:
            try:
                await ws.send(json.dumps(
                    {"type": "status",
                     "state": "listening" if self.listening else "ready"},
                    ensure_ascii=False))
            except Exception:
                pass
            async for raw in ws:
                try:
                    msg = json.loads(raw)
                except Exception:
                    continue
                t = msg.get("type")
                if t == "listen":
                    self.listening = bool(msg.get("active", True))
                    # 어댑터 세션 수명을 토글에 연동
                    try:
                        self.adapter.set_listening(self.listening)
                    except Exception as e:
                        print(f"set_listening failed: {e}", file=sys.stderr)
                    if not self.listening:
                        # 듣기 중지 시 미확정 interim을 final로 구제
                        try:
                            self.adapter.flush()
                        except Exception:
                            pass
                    await self.broadcast(
                        {"type": "status",
                         "state": "listening" if self.listening else "ready"})
                elif t == "reset":
                    try:
                        self.adapter.reset()
                    except Exception:
                        pass
                elif t == "set_device":
                    self.device = str(msg.get("device", "default"))
                    self.start_mic()
        finally:
            self.clients.discard(ws)
            print(f"ws disconn: client left (total={len(self.clients)})",
                  file=sys.stderr, flush=True)


async def _amain(args) -> None:
    import websockets

    try:
        adapter = load_adapter(args.adapter)
    except Exception as e:
        print(f"어댑터 로드 실패: {e}", file=sys.stderr)
        print("PORT=0", flush=True)
        traceback.print_exc()
        await asyncio.Event().wait()
        return

    try:
        options = json.loads(args.options_json or "{}")
    except Exception:
        options = {}
    if getattr(args, "api_key", ""):
        options["apiKey"] = args.api_key

    server = Server(adapter, args.device,
                    input_wav=args.input_wav, input_loop=args.input_loop)
    try:
        adapter.load(args.model_id, args.language, options)
    except Exception:
        load_error = traceback.format_exc(limit=5)
        print(load_error, file=sys.stderr)
        # 로드 실패해도 프로세스는 유지 → UI에 에러만 표시
        async def err_only(ws):
            try:
                await ws.send(json.dumps(
                    {"type": "status", "state": "error",
                     "detail": load_error[-2000:]},
                    ensure_ascii=False))
                async for _ in ws:
                    pass
            finally:
                pass
        srv = await websockets.serve(err_only, "127.0.0.1", args.port or 0)
        print(f"PORT={srv.sockets[0].getsockname()[1]}", flush=True)
        await srv.wait_closed()
        return

    srv = await websockets.serve(server.handler, "127.0.0.1", args.port or 0)
    port = srv.sockets[0].getsockname()[1]
    print(f"PORT={port}", flush=True)  # ← WPF가 파싱 (stdout은 이 줄 전용)
    print(f"ready adapter={args.adapter} port={port}", file=sys.stderr)
    server.loop = asyncio.get_running_loop()
    server.start_mic()
    await server.broadcast({"type": "status", "state": "ready"})
    try:
        await asyncio.gather(srv.wait_closed(), server.poll_loop())
    finally:
        server.stop_mic()
        try:
            adapter.unload()
        except Exception:
            pass


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--adapter", required=True)
    p.add_argument("--model-id", default="", dest="model_id")
    p.add_argument("--language", default="ko-KR")
    p.add_argument("--options-json", default="{}", dest="options_json")
    p.add_argument("--device", default="default")
    p.add_argument("--port", type=int, default=0)
    p.add_argument("--input-wav", default="",
                   help="테스트 모드: 마이크 대신 이 wav를 실시간 속도로 재생")
    p.add_argument("--input-loop", action="store_true",
                   help="--input-wav와 함께: 파일 끝에서 반복 재생")
    p.add_argument("--api-key", default="",
                   help="클라우드 어댑터용 API 키 (WPF가 settings.json에서 주입)")
    p.add_argument("--parent-pid", type=int, default=0, dest="parent_pid",
                   help="부모 PID. 지정하면 부모 사망 시 사이드카가 자살한다")
    args = p.parse_args()
    threading.Thread(target=_parent_watchdog, args=(args.parent_pid,),
                     daemon=True).start()
    asyncio.run(_amain(args))


if __name__ == "__main__":
    main()
