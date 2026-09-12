/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: BindingGraph. 의존 키→바인딩 역색인 + microtask 일괄 재평가.
*/

import type { UIElement } from "../Core/UIElement";
import type { Binding } from "./Binding";

export class BindingGraph
{
	// ==================== 멤버 ====================
	private readonly byOwner_ = new Map<UIElement, Set<Binding>>();
	private readonly byDep_ = new Map<string, Set<Binding>>();
	private readonly dirty_ = new Set<Binding>();
	private scheduled_ = false;
	private depth_ = 0;

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 바인딩을 등록한다.
	// @param _binding: 바인딩
	public Add(_binding: Binding): void
	{
		let set = this.byOwner_.get(_binding.Target);
		if (set === undefined)
		{
			set = new Set();
			this.byOwner_.set(_binding.Target, set);
		}
		set.add(_binding);
		for (const dep of _binding.Deps)
			this.Link(dep, _binding);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 의존 키가 바뀌었음을 알린다. Flush 1회 예약.
	// @param _dep: 의존 키
	public MarkDirty(_dep: string): void
	{
		const set = this.byDep_.get(_dep);
		if (set === undefined)
			return;
		for (const binding of set)
			this.dirty_.add(binding);
		if (!this.scheduled_)
		{
			this.scheduled_ = true;
			void Promise.resolve().then(() =>
			{
				this.scheduled_ = false;
				this.Flush();
			});
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 쌓인 바인딩을 재평가한다. 연쇄는 같은 Flush 안, 8단계 넘으면 중단.
	public Flush(): void
	{
		this.depth_ = 0;
		while (this.dirty_.size > 0)
		{
			if (this.depth_ > 8)
				break;
			this.depth_++;
			const batch = [...this.dirty_];
			this.dirty_.clear();
			for (const binding of batch)
			{
				try
				{
					for (const dep of [...binding.Deps])
						this.Unlink(dep, binding);
					binding.Evaluate();
				}
				catch
				{
					// 평가 실패는 해당 바인딩만 건너뛴다. P3 Log 연결 시 기록.
					continue;
				}
				for (const dep of binding.Deps)
					this.Link(dep, binding);
			}
		}
		this.dirty_.clear();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 등록된 의존 키 목록. $ 상대 의존의 광범위 무효화에 사용.
	public DepKeys(): string[]
	{
		return [...this.byDep_.keys()];
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 소유자 바인딩을 전부 제거한다. Reload·Dispose용.
	// @param _owner: 소유 요소 (하위 포함)
	public Clear(_owner: UIElement): void
	{
		const targets: UIElement[] = [_owner];
		for (let idx = 0; idx < targets.length; ++idx)
		{
			const current = targets[idx] as UIElement;
			for (const child of current.Children)
				targets.push(child);
		}
		for (const target of targets)
		{
			const set = this.byOwner_.get(target);
			if (set === undefined)
				continue;
			for (const binding of set)
			{
				for (const dep of binding.Deps)
					this.Unlink(dep, binding);
				binding.Dispose();
				this.dirty_.delete(binding);
			}
			this.byOwner_.delete(target);
		}
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 의존→바인딩 역색인을 건다.
	// @param _dep: 의존 키
	// @param _binding: 바인딩
	private Link(_dep: string, _binding: Binding): void
	{
		let set = this.byDep_.get(_dep);
		if (set === undefined)
		{
			set = new Set();
			this.byDep_.set(_dep, set);
		}
		set.add(_binding);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 역색인을 푼다.
	// @param _dep: 의존 키
	// @param _binding: 바인딩
	private Unlink(_dep: string, _binding: Binding): void
	{
		const set = this.byDep_.get(_dep);
		if (set === undefined)
			return;
		set.delete(_binding);
		if (set.size === 0)
			this.byDep_.delete(_dep);
	}
}
