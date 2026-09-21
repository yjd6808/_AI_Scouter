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
	{ Id: "lucide-chrome-minimize", Body: "<path d=\"M5 18h14\"/>" },
	{ Id: "lucide-square", Body: "<rect x=\"6\" y=\"6\" width=\"12\" height=\"12\" rx=\"1\"/>" },
	{ Id: "lucide-copy", Body: "<rect x=\"9\" y=\"9\" width=\"12\" height=\"12\" rx=\"2\"/><path d=\"M5 15V5a2 2 0 0 1 2-2h10\"/>" },
	{ Id: "lucide-x", Body: "<path d=\"M6 6l12 12M18 6L6 18\"/>" },
	{ Id: "lucide-pin", Body: "<path d=\"M9 4h6l1 7 3 3v2H5v-2l3-3z\"/><path d=\"M12 16v5\"/>" },
	{ Id: "lucide-pin-off", Body: "<path d=\"M9 4h6l1 7 3 3v2h-6\"/><path d=\"M5 16h5M12 16v5\"/><path d=\"M4 4l16 16\"/>" },
	{ Id: "lucide-chevron-down", Body: "<path d=\"M6 9l6 6 6-6\"/>" },
	{ Id: "lucide-chevron-right", Body: "<path d=\"M9 18l6-6-6-6\"/>" },
	{ Id: "lucide-chevrons-left", Body: "<path d=\"M11 17l-5-5 5-5\"/><path d=\"M18 17l-5-5 5-5\"/>" },
	{ Id: "lucide-chevrons-right", Body: "<path d=\"M13 17l5-5-5-5\"/><path d=\"M6 17l5-5-5-5\"/>" },
	{ Id: "lucide-search", Body: "<circle cx=\"11\" cy=\"11\" r=\"7\"/><path d=\"M21 21l-4.3-4.3\"/>" },
	{ Id: "lucide-package", Body: "<path d=\"M12 2l9 5v10l-9 5-9-5V7z\"/><path d=\"M12 12l9-5M12 12v10M12 12L3 7\"/>" },
	// 여기부터 Plugin 공용 범용 심볼. 이름은 lucide 원본 그대로 쓴다.
	{ Id: "lucide-plus", Body: "<path d=\"M5 12h14M12 5v14\"/>" },
	{ Id: "lucide-check", Body: "<path d=\"M20 6L9 17l-5-5\"/>" },
	{ Id: "lucide-trash", Body: "<path d=\"M3 6h18\"/><path d=\"M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6\"/><path d=\"M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2\"/>" },
	{ Id: "lucide-bell", Body: "<path d=\"M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9\"/><path d=\"M13.73 21a2 2 0 0 1-3.46 0\"/>" },
	{ Id: "lucide-alarm-clock", Body: "<circle cx=\"12\" cy=\"13\" r=\"8\"/><path d=\"M12 9v4l2 2\"/><path d=\"M5 3L2 6\"/><path d=\"M22 6l-3-3\"/><path d=\"M6.38 18.7L4 21\"/><path d=\"M17.64 18.67L20 21\"/>" },
	{ Id: "lucide-clock", Body: "<circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M12 6v6l4 2\"/>" },
	{ Id: "lucide-timer", Body: "<circle cx=\"12\" cy=\"14\" r=\"8\"/><path d=\"M10 2h4\"/><path d=\"M12 14l3-3\"/>" },
	{ Id: "lucide-play", Body: "<path d=\"M6 3l14 9-14 9z\"/>" },
	{ Id: "lucide-pause", Body: "<rect x=\"6\" y=\"4\" width=\"4\" height=\"16\" rx=\"1\"/><rect x=\"14\" y=\"4\" width=\"4\" height=\"16\" rx=\"1\"/>" },
	{ Id: "lucide-file-text", Body: "<path d=\"M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z\"/><path d=\"M14 2v5h5\"/><path d=\"M10 9H8\"/><path d=\"M16 13H8\"/><path d=\"M16 17H8\"/>" },
	{ Id: "lucide-command", Body: "<path d=\"M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3\"/>" },
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
	// 아이콘 이름이 등록되어 있는지 본다. Icon.Name과 같은 표기(접두 없는 이름)를 받는다.
	// 없는 이름은 use가 에러 없이 빈 공간으로 렌더되므로, 외부에서 온 이름은 그리기 전에 여기서 걸러야 한다.
	// @param _name: 아이콘 이름 (lucide- 접두는 붙여도 된다)
	public static Has(_name: string): boolean
	{
		if (_name.length === 0)
			return false;
		const id = _name.startsWith("lucide-") ? _name : `lucide-${_name}`;
		return kSymbols.some((_symbol) => _symbol.Id === id);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 테스트용 리셋. 주입 플래그만 되돌린다.
	public static ResetForTest(): void
	{
		IconSprite.s_injected_ = false;
		document.getElementById(kSpriteId)?.remove();
	}
}
