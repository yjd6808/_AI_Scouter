# ControlLab 레시피

모든 WPF 컨트롤이 잘 동작하는지 확인할 때 쓴다.

1. `scouter://ControlLab/recipes/ControlLab` 리소스를 읽는다.
2. `ControlLab__State`로 현재 이벤트 개수를 확인한다.
3. 화면에서 버튼·입력·목록·Scouter 탭을 눌러보고 `ControlLab__State` Count가 오르는지 확인한다.
4. `ControlLab__Log({ Name: "e2e", Detail: "확인" })`로 기록이 쌓이는지 확인한다.
5. 실패한 컨트롤이 있으면 이름·증상을 정리한다.
