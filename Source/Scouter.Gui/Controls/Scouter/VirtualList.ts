/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: VirtualList. 고정 높이 가상 렌더.
*/

import { UIElement } from "../../Core/UIElement";
import { UIProperty } from "../../Core/UIProperty";
import { RegisterElement } from "../RegisterElement";

@RegisterElement("VirtualList")
export class VirtualList extends UIElement
{
	// ==================== 정적 ====================
	public static readonly ItemHeightProperty = UIProperty.Register<number>("ItemHeight", VirtualList, { Default: 20, Parse: (_text) => Number(_text) });
	public static readonly OverscanProperty = UIProperty.Register<number>("Overscan", VirtualList, { Default: 5, Parse: (_text) => Number(_text) });

	// ==================== 멤버 ====================
	private count_ = 0;
	private itemTemplate_: ((_index: number) => UIElement) | null = null;
	private readonly viewport_: HTMLDivElement;
	private readonly spacer_: HTMLDivElement;
	private readonly pool_ = new Map<number, UIElement>();
	private raf_ = 0;
	private onScroll_: (() => void) | null = null;

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 뷰포트+스페이서를 만든다.
	public constructor()
	{
		super();
		this.Element.classList.add("gui-virtual");
		this.viewport_ = document.createElement("div");
		this.viewport_.className = "gui-virtual__viewport";
		this.spacer_ = document.createElement("div");
		this.spacer_.className = "gui-virtual__spacer";
		this.viewport_.append(this.spacer_);
		this.Element.append(this.viewport_);
		this.onScroll_ = () =>
		{
			this.ScheduleRender();
		};
		this.viewport_.addEventListener("scroll", this.onScroll_, { passive: true });
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 리스너·풀을 정리한다.
	protected override OnDispose(): void
	{
		if (this.onScroll_ !== null)
			this.viewport_.removeEventListener("scroll", this.onScroll_);
		if (this.raf_ !== 0)
			cancelAnimationFrame(this.raf_);
		for (const el of this.pool_.values())
			el.Dispose();
		this.pool_.clear();
	}

	// ==================== 속성 ====================
	public get Count(): number { return this.count_; }

	//////////////////////////////////////////////////////////////////////////////////////
	// 개수를 바꾼다. 음수는 0으로.
	public set Count(_v: number)
	{
		this.count_ = Math.max(0, _v);
		this.ScheduleRender();
	}

	public get ItemTemplate(): ((_index: number) => UIElement) | null { return this.itemTemplate_; }

	//////////////////////////////////////////////////////////////////////////////////////
	// 템플릿을 바꾼다. 다시 그린다.
	public set ItemTemplate(_v: ((_index: number) => UIElement) | null)
	{
		this.itemTemplate_ = _v;
		this.ScheduleRender();
	}

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 인덱스로 스크롤한다.
	// @param _index: 인덱스
	public ScrollToIndex(_index: number): void
	{
		this.viewport_.scrollTop = _index * this.GetValue(VirtualList.ItemHeightProperty);
		this.Render();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 강제 렌더. 테스트용.
	public Refresh(): void
	{
		this.Render();
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// rAF로 렌더를 모은다.
	private ScheduleRender(): void
	{
		if (this.raf_ !== 0)
			return;
		this.raf_ = requestAnimationFrame(() =>
		{
			this.raf_ = 0;
			this.Render();
		});
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 보이는 범위만 DOM에 둔다.
	private Render(): void
	{
		const template = this.itemTemplate_;
		if (template === null)
			return;
		const itemH = this.GetValue(VirtualList.ItemHeightProperty);
		const over = this.GetValue(VirtualList.OverscanProperty);
		const top = this.viewport_.scrollTop;
		const first = Math.max(0, Math.floor(top / itemH) - over);
		const last = Math.min(this.count_ - 1, Math.ceil((top + this.viewport_.clientHeight) / itemH) + over);
		this.spacer_.style.height = `${this.count_ * itemH}px`;
		for (const [idx, el] of [...this.pool_])
		{
			if (idx < first || idx > last)
			{
				el.Dispose();
				this.pool_.delete(idx);
			}
		}
		for (let idx = first; idx <= last; ++idx)
		{
			if (this.pool_.has(idx))
				continue;
			const el = template(idx);
			el.Element.style.transform = `translateY(${idx * itemH}px)`;
			this.spacer_.append(el.Element);
			this.pool_.set(idx, el);
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 등록 속성 변경을 DOM에 반영한다.
	// @param _prop: 속성
	// @param _value: 값
	protected override ApplyProperty(_prop: UIProperty<unknown>, _value: unknown): void
	{
		super.ApplyProperty(_prop, _value);
		if (_prop === VirtualList.ItemHeightProperty || _prop === VirtualList.OverscanProperty)
			this.ScheduleRender();
	}
}
