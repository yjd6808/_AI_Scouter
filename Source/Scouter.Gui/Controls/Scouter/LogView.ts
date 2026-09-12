/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: LogView. 링 버퍼 + VirtualList + 필터·레벨.
*/

import { UIElement } from "../../Core/UIElement";
import { UIProperty } from "../../Core/UIProperty";
import { Control } from "../Control";
import { RegisterElement } from "../RegisterElement";
import { TextBlock } from "../TextBlock";
import { RingBuffer } from "./RingBuffer";
import { VirtualList } from "./VirtualList";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface ILogEntry
{
	Ts: number;
	Level: LogLevel;
	Scope: string;
	Msg: string;
	Data?: unknown;
}

@RegisterElement("LogView")
export class LogView extends Control
{
	// ==================== 정적 ====================
	public static readonly MaxLinesProperty = UIProperty.Register<number>("MaxLines", LogView, { Default: 10000, Parse: (_text) => Number(_text) });
	public static readonly AutoScrollProperty = UIProperty.Register<boolean>("AutoScroll", LogView, { Default: true });
	public static readonly FilterProperty = UIProperty.Register<string>("Filter", LogView, { Default: "" });
	public static readonly LevelFilterProperty = UIProperty.Register<string>("LevelFilter", LogView, { Default: "" });

	// ==================== 멤버 ====================
	private ring_ = new RingBuffer<ILogEntry>(10000);
	private visible_: number[] = [];
	private readonly list_: VirtualList;
	private newCount_ = 0;

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 가상 리스트를 품는다.
	public constructor()
	{
		super();
		this.Element.classList.add("gui-logview");
		this.list_ = new VirtualList();
		this.AddChild(this.list_);
		this.list_.ItemTemplate = (_idx) => this.RenderRow(_idx);
		this.RebuildVisible();
	}

	// ==================== 속성 ====================
	public get AutoScroll(): boolean { return this.GetValue(LogView.AutoScrollProperty); }
	public set AutoScroll(_v: boolean) { this.SetValue(LogView.AutoScrollProperty, _v); }

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 1건을 쌓는다.
	// @param _entry: 항목
	public Append(_entry: ILogEntry): void
	{
		this.ring_.Push(_entry);
		while (this.ring_.Count > this.GetValue(LogView.MaxLinesProperty))
			this.TrimOldest();
		if (this.Passes(_entry))
		{
			this.visible_.push(this.ring_.Count - 1);
			this.list_.Count = this.visible_.length;
			if (this.AutoScroll)
				this.list_.ScrollToIndex(this.visible_.length - 1);
			else
				this.newCount_++;
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 전부 지운다.
	public Clear(): void
	{
		this.ring_.Clear();
		this.visible_ = [];
		this.newCount_ = 0;
		this.list_.Count = 0;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 전 행 텍스트를 복사 형태로 묶는다. 가상화라 DOM 선택 대신 재구성.
	public CopyAll(): string
	{
		const lines: string[] = [];
		for (const idx of this.visible_)
			lines.push(LogView.Format(this.ring_.Get(idx)));
		return lines.join("\n");
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 한 줄을 만든다.
	// @param _visibleIndex: 보이는 인덱스
	private RenderRow(_visibleIndex: number): UIElement
	{
		const row = new TextBlock();
		row.Element.classList.add("gui-logview__row");
		const entry = this.ring_.Get(this.visible_[_visibleIndex] as number);
		row.Text = LogView.Format(entry);
		if (entry.Level === "warn")
			row.Element.classList.add("is-warn");
		else if (entry.Level === "error")
			row.Element.classList.add("is-error");
		return row;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 필터를 다시 건다.
	private RebuildVisible(): void
	{
		this.visible_ = [];
		for (let idx = 0; idx < this.ring_.Count; ++idx)
		{
			if (this.Passes(this.ring_.Get(idx)))
				this.visible_.push(idx);
		}
		this.list_.Count = this.visible_.length;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 필터·레벨 통과 여부.
	// @param _entry: 항목
	private Passes(_entry: ILogEntry): boolean
	{
		const filter = this.GetValue(LogView.FilterProperty);
		if (filter.length > 0 && !_entry.Msg.includes(filter))
			return false;
		const level = this.GetValue(LogView.LevelFilterProperty);
		if (level.length > 0 && _entry.Level !== level)
			return false;
		return true;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 가장 오래된 것을 버린다. MaxLines 초과 시.
	private TrimOldest(): void
	{
		const kept: ILogEntry[] = [];
		for (let idx = 1; idx < this.ring_.Count; ++idx)
			kept.push(this.ring_.Get(idx));
		this.ring_.Clear();
		for (const entry of kept)
			this.ring_.Push(entry);
		this.RebuildVisible();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 한 줄 포맷.
	// @param _entry: 항목
	private static Format(_entry: ILogEntry): string
	{
		const time = new Date(_entry.Ts).toISOString().slice(11, 23);
		return `${time} [${_entry.Level.charAt(0).toUpperCase()}] ${_entry.Scope} ${_entry.Msg}`;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 등록 속성 변경을 DOM에 반영한다. 필터 바뀌면 다시 건다.
	// @param _prop: 속성
	// @param _value: 값
	protected override ApplyProperty(_prop: UIProperty<unknown>, _value: unknown): void
	{
		super.ApplyProperty(_prop, _value);
		if (_prop === LogView.FilterProperty || _prop === LogView.LevelFilterProperty)
			this.RebuildVisible();
	}
}
