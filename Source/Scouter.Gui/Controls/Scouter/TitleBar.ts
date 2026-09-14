/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: TitleBar. 커스텀 타이틀바 + 창 버튼. Chrome은 App 주입.
*/

import { UIProperty } from "../../Core/UIProperty";
import type { IDisposable } from "../../Core/Disposable";
import { Visibility } from "../../Core/UITypes";
import { Control } from "../Control";
import { RegisterElement } from "../RegisterElement";
import { Button } from "../Button";
import { Icon } from "../Icon";
import { TextBlock } from "../TextBlock";
import type { IWindowChrome } from "./IWindowChrome";

@RegisterElement("TitleBar")
export class TitleBar extends Control
{
	// ==================== 정적 ====================
	public static readonly TitleProperty = UIProperty.Register<string>("Title", TitleBar, { Default: "Scouter" });
	public static readonly IconProperty = UIProperty.Register<string>("Icon", TitleBar, { Default: "" });

	// ==================== 멤버 ====================
	private chrome_: IWindowChrome | null = null;
	private chromeBag_: IDisposable[] = [];
	private readonly icon_: Icon;
	private readonly title_: TextBlock;
	private readonly pin_: Button;
	private readonly min_: Button;
	private readonly max_: Button;
	private readonly close_: Button;

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 드래그 영역 + 버튼 4개를 만든다. 버튼은 왼쪽부터 고정·최소화·최대화·닫기 순서로 붙인다.
	public constructor()
	{
		super();
		this.Element.classList.add("gui-titlebar");
		this.icon_ = new Icon();
		this.title_ = new TextBlock();
		this.title_.Element.classList.add("gui-titlebar__title");
		this.pin_ = TitleBar.MakeChromeButton("pin", "항상 위");
		this.min_ = TitleBar.MakeChromeButton("chrome-minimize", "최소화");
		this.max_ = TitleBar.MakeChromeButton("square", "최대화");
		this.close_ = TitleBar.MakeChromeButton("x", "닫기");
		this.close_.Element.classList.add("is-close");
		this.AddChild(this.icon_);
		this.AddChild(this.title_);
		this.AddChild(this.pin_);
		this.AddChild(this.min_);
		this.AddChild(this.max_);
		this.AddChild(this.close_);
		this.pin_.Click.Add(() => { void this.ToggleTopmostAsync(); });
		this.min_.Click.Add(() => { this.chrome_?.Minimize(); });
		this.max_.Click.Add(() => { this.chrome_?.ToggleMaximize(); });
		this.close_.Click.Add(() => { this.chrome_?.Close(); });
		this.ApplyTitle(this.Title);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 크롬 구독을 끊는다.
	protected override OnDispose(): void
	{
		this.DetachChrome();
	}

	// ==================== 속성 ====================
	public get Title(): string { return this.GetValue(TitleBar.TitleProperty); }
	public set Title(_v: string) { this.SetValue(TitleBar.TitleProperty, _v); }
	public get Chrome(): IWindowChrome | null { return this.chrome_; }

	//////////////////////////////////////////////////////////////////////////////////////
	// 창 크롬을 꽂는다. 최대화·고정 상태를 읽어 아이콘을 맞춘다.
	public set Chrome(_v: IWindowChrome | null)
	{
		this.DetachChrome();
		this.chrome_ = _v;
		if (_v === null)
			return;
		this.chromeBag_.push(_v.MaximizedChanged.Add((_max) => { this.ApplyMaximized(_max); }));
		if (_v.TopmostChanged !== undefined)
			this.chromeBag_.push(_v.TopmostChanged.Add((_top) => { this.ApplyTopmost(_top); }));
		void _v.IsMaximized().then((_max) => { this.ApplyMaximized(_max); });
		if (_v.IsTopmost !== undefined)
		{
			this.pin_.Visibility = Visibility.Visible;
			void _v.IsTopmost().then((_top) => { this.ApplyTopmost(_top); });
		}
		else
		{
			this.pin_.Visibility = Visibility.Collapsed;
		}
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 크롬 버튼 1개를 만든다.
	// @param _icon: 아이콘 이름
	// @param _tip: 툴팁
	private static MakeChromeButton(_icon: string, _tip: string): Button
	{
		const btn = new Button();
		btn.Variant = "Ghost";
		btn.Icon = _icon;
		btn.ToolTip = _tip;
		btn.Element.classList.add("gui-titlebar__btn", "no-drag");
		return btn;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 제목을 쓴다.
	// @param _title: 제목
	private ApplyTitle(_title: string): void
	{
		this.title_.Text = _title;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 최대화 아이콘을 바꾼다.
	// @param _max: 최대화 여부
	private ApplyMaximized(_max: boolean): void
	{
		this.max_.Icon = _max ? "copy" : "square";
		this.max_.ToolTip = _max ? "복원" : "최대화";
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 고정 아이콘을 바꾼다.
	// @param _top: 항상 위 여부
	private ApplyTopmost(_top: boolean): void
	{
		this.pin_.Icon = _top ? "pin-off" : "pin";
		this.pin_.ToolTip = _top ? "항상 위 해제" : "항상 위";
		this.pin_.Element.classList.toggle("is-active", _top);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 고정을 뒤집고 아이콘을 맞춘다. 크롬 미지원이면 무시.
	private async ToggleTopmostAsync(): Promise<void>
	{
		const chrome = this.chrome_;
		if (chrome?.ToggleTopmost === undefined)
			return;
		this.ApplyTopmost(await chrome.ToggleTopmost());
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 크롬 구독을 끊는다.
	private DetachChrome(): void
	{
		for (const entry of this.chromeBag_)
			entry.Dispose();
		this.chromeBag_ = [];
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 등록 속성 변경을 DOM에 반영한다.
	// @param _prop: 속성
	// @param _value: 값
	protected override ApplyProperty(_prop: UIProperty<unknown>, _value: unknown): void
	{
		super.ApplyProperty(_prop, _value);
		if (_prop === TitleBar.TitleProperty)
			this.ApplyTitle(_value as string);
		else if (_prop === TitleBar.IconProperty)
			this.icon_.Name = _value as string;
	}
}
