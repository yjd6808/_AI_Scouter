# ExtractFiles 레시피

범위 파일 추출 순서.

1. From/To가 체인지 번호인지 리비전인지 확인한다. 체인지 번호면 그대로, 리비전이면 Depot 경로에 `#` 범위를 쓴다.
2. 500개 이상 체인지가 잡히면 사용자에게 범위 확인을 받는다. Tool이 `{NeedsConfirm, ChangeCount}`를 반환한다.
3. 결과는 `Output=File`로 받아 경로만 전달한다. 전체 목록을 채팅에 붙이지 않는다.
4. 리뷰가 목적이면 `Review.md`로 넘어간다.
