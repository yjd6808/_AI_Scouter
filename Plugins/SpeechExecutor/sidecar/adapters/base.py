"""ASR 어댑터 베이스 클래스.

새 모델 추가 방법: 이 파일을 상속한 `adapters/<이름>.py` 1개 작성 +
`config/models.json`에 항목 1개 추가. asr_server.py 수정 불필요.

이벤트 종류: "partial" | "final". 어댑터 내부 상태 보고가 필요하면
kind="__status__" + text=메시지로 보내면 서버가 status/error로 변환한다.
options["apiKey"]에 클라우드 API 키가 주입될 수 있다 (WPF settings.json).
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class AsrEvent:
    kind: str  # "partial" | "final" | "__status__"
    text: str


class AsrAdapter(ABC):
    @abstractmethod
    def load(self, model_id: str, language: str, options: dict) -> None:
        """모델/세션 준비. 실패 시 예외를 던지면 서버가 status=error로 보고한다."""
        ...

    @abstractmethod
    def feed(self, pcm: bytes) -> None:
        """16kHz mono int16 PCM 주입."""
        ...

    @abstractmethod
    def poll(self) -> list[AsrEvent]:
        """누적된 partial/final 이벤트 반환 후 내부 큐 비움."""
        ...

    @abstractmethod
    def reset(self) -> None:
        """발화 상태 초기화."""
        ...

    def flush(self) -> None:
        """미확정 partial을 final로 확정. 짧은 발화 구제용. 기본 동작 없음."""
        ...

    def set_listening(self, active: bool) -> None:
        """듣기 상태 변경 통지. 세션 수명을 토글에 묶을 때 override. 기본 동작 없음."""
        ...

    @abstractmethod
    def unload(self) -> None:
        """세션/모델 해제."""
        ...
