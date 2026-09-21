/*
	작성자: 윤정도
	생성일: 2026-09-14
	=====
	설명: SidebarGroupHeader. 사이드바 영역·그룹 헤더 한 줄. 셰브론 아이콘으로 접고 펴며 F2로 이름을 고친다.
	사이드바 전용 표현이라 Scouter.Gui 범용 컨트롤로 만들지 않고 App 쪽에 둔다.
	값이 그대로면 DOM을 건드리지 않는다. 같은 입력으로 다시 그려도 변경 0건이라는 사이드바 성질을 지켜야 하기 때문이다.
*/

import { Control, Icon, TextBox, SimpleEvent } from "@scouter/gui";

export class SidebarGroupHeader extends Control
{
	// ==================== 멤버 ====================
	private readonly chevron_: Icon;
	private readonly label_: HTMLSpanElement;
	private editor_: TextBox | null = null;
	private title_ = "";
	private depth_ = -1;
	private collapsed_ = false;
	private canRename_ = false;
	private editing_ = false;
	private closing_ = false;
	private pressed_ = false;

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 셰브론 + 제목 구조를 만들고 헤더 전체를 클릭·키 대상으로 만든다.
	// 아이콘만 클릭 대상이면 불편하므로 줄 전체에서 접기가 동작한다.
	public constructor()
	{
		super();
		this.Element.classList.add("gui-navheader");
		this.Element.setAttribute("role", "button");
		this.Focusable = true;
		this.chevron_ = new Icon();
		this.chevron_.Element.classList.add("gui-navheader__chevron");
		this.chevron_.Name = "chevron-down";	// 접힘은 CSS 회전(is-folded)으로 표현한다. chevron-right 심볼로 갈아끼우면 전환 애니메이션이 끊긴다.
		this.AddChild(this.chevron_);
		this.label_ = document.createElement("span");
		this.label_.className = "gui-navheader__text";
		this.Element.append(this.label_);
		this.Element.addEventListener("pointerdown", (_e) => { this.pressed_ = _e.button === 0; });
		this.Element.addEventListener("pointerup", (_e) => { this.OnHeaderUp(_e); });
		this.Element.addEventListener("pointerleave", () => { this.pressed_ = false; });
		this.Element.addEventListener("keydown", (_e) => { this.OnHeaderKey(_e); });
		this.Element.setAttribute("aria-expanded", "true");
		this.Depth = 0;
	}

	// ==================== 속성 ====================
	public get Title(): string { return this.title_; }
	public get IsCollapsed(): boolean { return this.collapsed_; }
	public get IsEditing(): boolean { return this.editing_; }
	public get CanRename(): boolean { return this.canRename_; }
	public set CanRename(_v: boolean) { this.canRename_ = _v; }
	public get Depth(): number { return this.depth_; }

	//////////////////////////////////////////////////////////////////////////////////////
	// 제목을 쓴다. 같은 값이면 DOM을 건드리지 않는다.
	// @param _v: 제목
	public set Title(_v: string)
	{
		if (this.title_ === _v)
			return;
		this.title_ = _v;
		this.label_.textContent = _v;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 접힘 상태를 쓴다. 셰브론 회전은 CSS가 is-folded로 처리한다.
	// is-collapsed는 프레임워크가 Visibility.Collapsed(display:none)에 쓰는 이름이라 절대 쓰면 안 된다.
	// @param _v: 접힘 여부
	public set IsCollapsed(_v: boolean)
	{
		if (this.collapsed_ === _v)
			return;
		this.collapsed_ = _v;
		this.Element.classList.toggle("is-folded", _v);
		this.Element.setAttribute("aria-expanded", _v ? "false" : "true");
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 들여쓰기 단계를 쓴다. 픽셀은 CSS 변수(--gui-nav-indent)가 정한다.
	// @param _v: 단계 (영역 0, 그룹 1)
	public set Depth(_v: number)
	{
		if (this.depth_ === _v)
			return;
		this.depth_ = _v;
		this.Element.style.setProperty("--gui-nav-depth", String(_v));
	}

	// ==================== 이벤트 ====================
	public readonly Toggled = new SimpleEvent<boolean>();
	public readonly Renamed = new SimpleEvent<string>();

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 인라인 이름 편집으로 들어간다. 이름을 바꿀 수 없는 헤더면 진입 자체를 막는다.
	public BeginEdit(): boolean
	{
		if (!this.canRename_ || this.editing_)
			return false;
		this.editing_ = true;
		this.closing_ = false;
		this.Element.classList.add("is-editing");
		this.label_.style.display = "none";
		const editor = this.CreateEditor();
		this.editor_ = editor;
		this.AddChild(editor);
		editor.Text = this.title_;
		const input = editor.Element.querySelector("input");
		if (input !== null)
			input.focus({ preventScroll: true });
		editor.SelectAll();
		return true;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 편집을 버린다. 원래 이름을 그대로 둔다.
	public CancelEdit(): void
	{
		if (!this.editing_)
			return;
		this.EndEdit();
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 편집용 TextBox를 만든다. Enter·포커스 이탈이면 확정, ESC면 취소다.
	private CreateEditor(): TextBox
	{
		const editor = new TextBox();
		editor.Name = `${this.Name}__edit`;
		editor.Element.classList.add("gui-navheader__edit");
		editor.TextCommitted.Add(() => { this.CommitEdit(); });
		editor.Element.addEventListener("keydown", (_e) =>
		{
			_e.stopPropagation();	// Enter·Space가 헤더까지 올라가면 확정 직후 접힘이 뒤집힌다.
			if (_e.key === "Escape")
				this.CancelEdit();
		});
		return editor;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 편집을 확정한다. 빈 이름은 거부하고 원래 이름을 유지한다.
	// 편집 종료가 blur를 부르고 blur가 다시 확정을 부르므로 닫는 중이면 무시한다.
	private CommitEdit(): void
	{
		if (!this.editing_ || this.closing_)
			return;
		const typed = this.editor_?.Text ?? "";
		const name = typed.trim();
		this.EndEdit();
		if (name.length === 0 || name === this.title_)
			return;
		this.Renamed.Invoke(name);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 편집 상태를 걷고 제목 표시로 되돌린다.
	// 편집 칸에 포커스가 있던 경우(Enter·ESC)만 헤더로 포커스를 돌린다. 밖을 눌러 끝났다면 뺏지 않는다.
	private EndEdit(): void
	{
		this.closing_ = true;
		const editor = this.editor_;
		const keepFocus = editor !== null && editor.Element.contains(document.activeElement);
		this.editor_ = null;
		this.editing_ = false;
		if (editor !== null)
			this.RemoveChild(editor, true);
		this.label_.style.display = "";
		this.Element.classList.remove("is-editing");
		this.closing_ = false;
		if (keepFocus)
			this.Focus();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 이 헤더에서 왼쪽 버튼을 눌렀다 뗀 경우에만 접힘을 뒤집는다. 우클릭은 컨텍스트 메뉴 몫이다.
	// 누름을 확인하지 않으면 항목을 헤더 위에 떨어뜨린 드롭의 pointerup까지 접힘으로 먹는다.
	// @param _e: 포인터 이벤트
	private OnHeaderUp(_e: PointerEvent): void
	{
		const pressed = this.pressed_;
		this.pressed_ = false;
		if (!pressed || this.editing_ || _e.button !== 0)
			return;
		this.Toggled.Invoke(!this.collapsed_);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// F2면 이름 편집, Enter·Space면 접힘 토글. 편집 중 키는 TextBox 몫이다.
	// @param _e: 키 이벤트
	private OnHeaderKey(_e: KeyboardEvent): void
	{
		if (this.editing_)
			return;
		if (_e.key === "F2")
		{
			_e.preventDefault();
			this.BeginEdit();
			return;
		}
		if (_e.key !== "Enter" && _e.key !== " ")
			return;
		_e.preventDefault();
		this.Toggled.Invoke(!this.collapsed_);
	}
}
