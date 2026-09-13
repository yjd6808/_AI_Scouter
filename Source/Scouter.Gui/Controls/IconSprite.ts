/*
	작성자: 윤정도
	생성일: 2026-09-13
	=====
	설명: IconSprite. SVG 심볼을 문서에 1회 주입한다. use 참조용.
*/

const kSpriteId = "scouter-icon-sprite";

const kSymbols: ReadonlyArray<{ Id: string; Body: string }> = [
	{ Id: "lucide-scouter", Body: "<circle cx=\"12\" cy=\"12\" r=\"9\"/><circle cx=\"12\" cy=\"12\" r=\"3\"/>" },
	{ Id: "lucide-settings", Body: "<circle cx=\"12\" cy=\"12\" r=\"3\"/><path d=\"M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1\"/>" },
	{ Id: "lucide-panel-left-close", Body: "<rect x=\"3\" y=\"4\" width=\"18\" height=\"16\" rx=\"2\"/><path d=\"M9 4v16M14 10l-2 2 2 2\"/>" },
	{ Id: "lucide-panel-left-open", Body: "<rect x=\"3\" y=\"4\" width=\"18\" height=\"16\" rx=\"2\"/><path d=\"M9 4v16M10 10l2 2-2 2\"/>" },
	{ Id: "lucide-minus", Body: "<path d=\"M5 12h14\"/>" },
	{ Id: "lucide-square", Body: "<rect x=\"6\" y=\"6\" width=\"12\" height=\"12\" rx=\"1\"/>" },
	{ Id: "lucide-copy", Body: "<rect x=\"9\" y=\"9\" width=\"12\" height=\"12\" rx=\"2\"/><path d=\"M5 15V5a2 2 0 0 1 2-2h10\"/>" },
	{ Id: "lucide-x", Body: "<path d=\"M6 6l12 12M18 6L6 18\"/>" },
	{ Id: "lucide-pin", Body: "<path d=\"M9 4h6l1 7 3 3v2H5v-2l3-3z\"/><path d=\"M12 16v5\"/>" },
	{ Id: "lucide-pin-off", Body: "<path d=\"M9 4h6l1 7 3 3v2h-6\"/><path d=\"M5 16h5M12 16v5\"/><path d=\"M4 4l16 16\"/>" },
	{ Id: "lucide-chevron-down", Body: "<path d=\"M6 9l6 6 6-6\"/>" },
	{ Id: "lucide-chevrons-left", Body: "<path d=\"M11 17l-5-5 5-5\"/><path d=\"M18 17l-5-5 5-5\"/>" },
	{ Id: "lucide-chevrons-right", Body: "<path d=\"M13 17l5-5-5-5\"/><path d=\"M6 17l5-5-5-5\"/>" },
	{ Id: "lucide-search", Body: "<circle cx=\"11\" cy=\"11\" r=\"7\"/><path d=\"M21 21l-4.3-4.3\"/>" },
	{ Id: "lucide-package", Body: "<path d=\"M12 2l9 5v10l-9 5-9-5V7z\"/><path d=\"M12 12l9-5M12 12v10M12 12L3 7\"/>" },
];

export class IconSprite
{
	// ==================== 정적 ====================
	private static s_injected_ = false;

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 심볼 svg를 body에 꽂는다. 두 번 호출해도 1회만.
	public static Ensure(): void
	{
		if (IconSprite.s_injected_)
			return;
		IconSprite.s_injected_ = true;
		if (document.getElementById(kSpriteId) !== null)
			return;
		const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
		svg.setAttribute("id", kSpriteId);
		svg.setAttribute("aria-hidden", "true");
		svg.setAttribute("width", "0");
		svg.setAttribute("height", "0");
		svg.style.position = "absolute";
		for (const symbol of kSymbols)
		{
			const node = document.createElementNS("http://www.w3.org/2000/svg", "symbol");
			node.setAttribute("id", symbol.Id);
			node.setAttribute("viewBox", "0 0 24 24");
			node.innerHTML = symbol.Body;
			svg.append(node);
		}
		document.body.prepend(svg);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 등록 심볼 Id 목록을 반환한다. 테스트용.
	public static Ids(): string[]
	{
		return kSymbols.map((_s) => _s.Id);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 테스트용 리셋. 주입 플래그만 되돌린다.
	public static ResetForTest(): void
	{
		IconSprite.s_injected_ = false;
		document.getElementById(kSpriteId)?.remove();
	}
}
