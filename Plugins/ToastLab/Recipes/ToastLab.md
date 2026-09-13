# ToastLab 레시피 (외부 AI용)

> 사용자에게 보여줄 것이 아니라 네가 따를 절차다.

## 토스트 확인
1. `ToastLab__Notify({ Kind, Title })`로 띄운다. `Kind`는 info·success·warn·error.
2. 긴 설명은 `Message`에 둔다. 제목만이면 `Title`만 준다.
3. 바탕화면 우측 하단 topmost 창에도 띄우려면 `Global: true`를 준다. 앱 Toast와 같은 모양·지속 시간이다.
4. 화면에서 직접 눌러 볼 땐 Toast Lab 화면의 종류 버튼을 쓴다. 체크박스로 바탕화면 표시를 고른다.

## 금지
- 에러 토스트는 계속 떠 있으니 확인 뒤 직접 닫는다.
- 지속 시간은 ScouterCore 설정 일반의 토스트 표시 시간을 따른다.
