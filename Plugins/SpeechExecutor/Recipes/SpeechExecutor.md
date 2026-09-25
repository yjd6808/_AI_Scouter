# SpeechExecutor

음성을 텍스트로 받아 피어에게 전달하고, 트리거 문구가 나오면 플러그인 함수를 실행한다.

## 준비

1. Python 3.11+ 설치.
2. 사이드카 의존성 설치 (플러그인 폴더 기준):
   `python -m pip install -r sidecar/requirements.txt`
   (websockets, numpy, sounddevice, google-genai)
3. API 탭 → Gemini 키 추가 → 적용. 키는 플러그인 저장소에 평문 보관된다.

## 사용

1. Home 탭. 서버면 `0.0.0.0:9999` 입력 후 리슨, 클라이언트면 `상대IP:9999` 입력 후 연결.
2. 리슨 중에는 연결 불가, 연결 중에는 리슨 불가 (배타).
3. 말하면 인식 텍스트가 표시되고 피어에게 전달된다. 트리거 매핑에 맞는 문구면
   매핑된 함수가 실행된다. 트리거 차단을 켜면 매칭을 생략한다.
4. 함수 소스는 Home 탭 에디터에서 고치고 적용. `StorageDir/SpeechFunctions.js`가
   원본이라 파일 직접 수정도 0.5초 폴링으로 자동 반영된다.

## 프로토콜 (TCP, UTF-8, 줄바꿈 구분 JSON)

- `{"type":"final","text":"..."}` — 확정 텍스트 (final만 전송)
- `{"type":"ping","ts":1234567890}` — 30초마다 양방향 하트비트

## MCP Tool

- `SpeechExecutor__SendText` — 연결된 피어에게 텍스트 1건 전송.
