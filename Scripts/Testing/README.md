# Scripts/Testing — UI 육안 검증 스크립트 (AI용)

> E2E 합성 이벤트는 hit-testing을 우회한다. 클릭·호버·툴팁 계열 수정 뒤에는
> 이 스크립트로 실마우스 재현 + 캡처 후 Read 도구로 이미지를 확인한다.

## Capture-Window.ps1

창을 앞으로 가져와 화면 합성본으로 캡처한다.

```
powershell -NoProfile -ExecutionPolicy Bypass -File Scripts/Testing/Capture-Window.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File Scripts/Testing/Capture-Window.ps1 -Title "Scouter" -Out "$env:TEMP\opencode\shot.png"
```

- 왜 이 방식: `PrintWindow`는 GPU 가속 창이 검게 나온다. Foreground + `CopyFromScreen`만 쓴다.
- 캡처 뒤 Read 도구로 PNG를 읽는다. 창이 없으면 `NO_WINDOW` 종료코드 1.

## Send-Mouse.ps1

실제 커서 이동·클릭. 좌표는 화면 절대좌표. 창 위치는 캡처 출력 `RECT:`에서 확인.

```
powershell -NoProfile -ExecutionPolicy Bypass -File Scripts/Testing/Send-Mouse.ps1 hover 390 340
powershell -NoProfile -ExecutionPolicy Bypass -File Scripts/Testing/Send-Mouse.ps1 click 390 340
powershell -NoProfile -ExecutionPolicy Bypass -File Scripts/Testing/Send-Mouse.ps1 rclick 390 340
```

- `hover` 뒤 1초 대기 → 캡처하면 툴팁(400ms 지연) 상태까지 보인다.
- `click` 뒤 2초 대기 → 캡처하면 화면 전환까지 보인다.
- `rclick`은 우클릭. 컨텍스트 메뉴 위치·항목 확인용.
- 용도: 호버 덮개·툴팁 가로챔·사이드바 이동 같은 실마우스 전용 버그 재현.
  (P10 스플리터가 사이드바를 덮던 버그는 이 방식으로만 잡혔다.)

## /test/eval DOM 프로브 (스크립트 아님, 방법)

`--test` 실행이면 `POST /test/eval {Script}`로 DOM을 찌른다.
`getBoundingClientRect`·`getComputedStyle`·`elementFromPoint`·`querySelector` 조합으로
배치·색상·히트 대상을 확정한다. 일시 스크립트는 레포에 두지 않는다
(두면 eslint에 걸린다. `.gitignore`의 `probe-*` 참조).
