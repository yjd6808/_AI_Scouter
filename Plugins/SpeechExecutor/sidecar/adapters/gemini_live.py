"""Gemini Live Transcribe 어댑터 (클라우드 STT).

모델: gemini-3.5-transcribe-live (실시간 전사 전용)
- 세션 수명 = 듣기 토글에 연동. 듣기 시작 → Live 세션 연결,
  듣기 중지 → 세션 종료. (이전에는 프로세스 수명 동안 유지)
- 마이크 PCM은 서버가 feed()로 주입 → Live 세션으로 실시간 전송
- interim → partial, input_transcription → final 이벤트로 변환
- 연결/끊김은 __connected__/__disconnected__ 이벤트로 보고 → UI 로그
- API 키: options["apiKey"] (WPF가 api_key.json에서 주입) 또는 환경변수 GEMINI_API_KEY
- 로컬 음성 모델 불필요. requirements: google-genai, websockets, numpy, sounddevice

원형: E:\\Programming\\AIProject\\Test\\SpeechDictator\\dictate.py
"""
from __future__ import annotations

import asyncio
import queue
import threading
import time

from .base import AsrAdapter, AsrEvent


class GeminiLiveAdapter(AsrAdapter):
    def __init__(self) -> None:
        self._events: queue.Queue[AsrEvent] = queue.Queue()
        self._pcm: asyncio.Queue | None = None
        self._loop: asyncio.AbstractEventLoop | None = None
        self._sess_thread: threading.Thread | None = None
        self._wd_thread: threading.Thread | None = None
        self._tasks: set = set()
        self._stop = threading.Event()  # 어댑터 전체 종료
        self._session_stop = threading.Event()  # 현 세션 종료
        self._user_stop = False  # 듣기 중지에 의한 종료 표시
        self._api_key = ""
        self._model_id = "gemini-3.5-transcribe-live"
        self._language = "ko-KR"
        self._lock = threading.Lock()
        self._pending = ""  # 마지막 interim (final 미확정)
        self._pending_time = 0.0
        self._flushed = ""  # flush로 선방출한 텍스트 (뒤늦은 중복 final 제거용)
        self._flushed_time = 0.0

    def load(self, model_id: str, language: str, options: dict) -> None:
        import os

        opts = options or {}
        api_key = str(opts.get("apiKey") or os.environ.get("GEMINI_API_KEY") or "")
        if not api_key:
            raise RuntimeError(
                "Gemini API 키가 없습니다. API 탭에서 키를 추가·적용하세요."
            )
        self._api_key = api_key
        self._model_id = model_id or self._model_id
        self._language = language or "ko-KR"
        self._stop.clear()
        # 세션은 듣기 시작 때 열린다. 워치독만 상시 가동.
        if self._wd_thread is None or not self._wd_thread.is_alive():
            self._wd_thread = threading.Thread(target=self._watchdog, daemon=True)
            self._wd_thread.start()

    def set_listening(self, active: bool) -> None:
        if active:
            self._start_session()
        else:
            self._stop_session(user=True)

    def feed(self, pcm: bytes) -> None:
        if self._loop is not None and self._pcm is not None and pcm:
            self._loop.call_soon_threadsafe(self._pcm.put_nowait, pcm)

    def poll(self) -> list[AsrEvent]:
        out: list[AsrEvent] = []
        while True:
            try:
                out.append(self._events.get_nowait())
            except queue.Empty:
                break
        return out

    def reset(self) -> None:
        with self._lock:
            self._pending = ""
            self._flushed = ""
        while True:
            try:
                self._events.get_nowait()
            except queue.Empty:
                break

    def flush(self) -> None:
        """미확정 interim을 final로 확정 (짧은 발화 구제)."""
        with self._lock:
            text = self._pending.strip()
            self._pending = ""
            if not text:
                return
            self._flushed = text
            self._flushed_time = time.monotonic()
        self._events.put(AsrEvent(kind="final", text=text))

    def unload(self) -> None:
        self._stop.set()
        self._stop_session(user=True)
        if self._sess_thread is not None:
            self._sess_thread.join(timeout=8)
            self._sess_thread = None

    # -- 세션 수명 ------------------------------------------------------------
    def _start_session(self) -> None:
        if self._sess_thread is not None and self._sess_thread.is_alive():
            return
        if not self._api_key:
            self._events.put(AsrEvent(
                kind="__status__", text="세션 시작 실패: API 키 없음"))
            return
        self._session_stop.clear()
        self._user_stop = False
        self._sess_thread = threading.Thread(target=self._run_session, daemon=True)
        self._sess_thread.start()

    def _stop_session(self, user: bool) -> None:
        if user:
            self._user_stop = True
        self._session_stop.set()
        loop = self._loop
        if loop is not None:
            try:
                loop.call_soon_threadsafe(self._cancel_tasks)
            except Exception:
                pass

    def _cancel_tasks(self) -> None:
        for t in list(self._tasks):
            try:
                t.cancel()
            except Exception:
                pass

    def _run_session(self) -> None:
        asyncio.run(self._session_main())

    # -- 내부 ----------------------------------------------------------------
    def _watchdog(self) -> None:
        """2초간 새 interim 없이 pending이 남으면 final로 확정."""
        while not self._stop.wait(0.2):
            with self._lock:
                stale = (bool(self._pending.strip())
                         and time.monotonic() - self._pending_time > 2.0)
            if stale:
                self.flush()

    async def _session_main(self) -> None:
        from google import genai
        from google.genai import types

        codes = [] if self._language == "auto" else [self._language]
        aborted = False  # 열리기도 전에 중지됨: 연결/끊김 로그 모두 생략
        try:
            client = genai.Client(api_key=self._api_key)
            config = types.LiveConnectConfig(
                response_modalities=["TEXT"],
                input_audio_transcription=types.AudioTranscriptionConfig(
                    language_codes=codes,
                ),
            )
            self._loop = asyncio.get_running_loop()
            self._pcm = asyncio.Queue()
            async with client.aio.live.connect(
                    model=self._model_id, config=config) as session:
                if self._session_stop.is_set() or self._stop.is_set():
                    aborted = True
                    return
                self._events.put(AsrEvent(
                    kind="__connected__",
                    text=f"{self._model_id} 세션 연결됨"))
                sender = asyncio.create_task(self._sender(session))
                receiver = asyncio.create_task(self._receiver(session))
                self._tasks = {sender, receiver}
                try:
                    await asyncio.gather(sender, receiver)
                except asyncio.CancelledError:
                    pass
                finally:
                    self._tasks = set()
        except Exception as e:
            if not self._stop.is_set():
                self._events.put(AsrEvent(
                    kind="__status__", text=f"Gemini 세션 오류: {e}"))
        finally:
            self._loop = None
            self._pcm = None
            if aborted:
                return
            if self._user_stop or self._stop.is_set():
                reason = "듣기 중지"
            else:
                reason = "세션 종료"
            self._events.put(AsrEvent(
                kind="__disconnected__",
                text=f"{self._model_id} 세션 끊어짐 ({reason})"))

    async def _sender(self, session) -> None:
        from google.genai import types

        assert self._pcm is not None
        while not self._session_stop.is_set() and not self._stop.is_set():
            try:
                chunk = await asyncio.wait_for(self._pcm.get(), timeout=0.5)
            except asyncio.TimeoutError:
                continue
            try:
                await session.send_realtime_input(
                    audio=types.Blob(data=chunk, mime_type="audio/pcm;rate=16000"))
            except Exception:
                return

    async def _receiver(self, session) -> None:
        try:
            async for msg in session.receive():
                if self._session_stop.is_set() or self._stop.is_set():
                    return
                sc = msg.server_content
                if sc is None:
                    continue
                interim = getattr(sc, "interim_input_transcription", None)
                if interim and interim.text:
                    with self._lock:
                        self._pending = interim.text
                        self._pending_time = time.monotonic()
                    self._events.put(AsrEvent(kind="partial", text=interim.text))
                final = getattr(sc, "input_transcription", None)
                if final and final.text:
                    with self._lock:
                        # flush로 이미 내보낸 텍스트의 뒤늦은 중복은 버린다
                        if (self._flushed and final.text == self._flushed
                                and time.monotonic() - self._flushed_time < 5.0):
                            self._flushed = ""
                            self._pending = ""
                            continue
                        self._flushed = ""
                        self._pending = ""
                    self._events.put(AsrEvent(kind="final", text=final.text))
        except Exception as e:
            if not self._session_stop.is_set() and not self._stop.is_set():
                self._events.put(AsrEvent(
                    kind="__status__", text=f"Gemini 수신 오류: {e}"))
