/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: PluginBase. Activate/Deactivate 수명. OnXxx만 재정의.
*/

import type { IPluginContext } from "./IPluginContext";

export abstract class PluginBase
{
	// ==================== 멤버 ====================
	private context_: IPluginContext | null = null;

	// ==================== 속성 ====================
	public get Id(): string { return this.context_?.Manifest.Id ?? ""; }

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 활성화한다. 매니저 전용.
	// @param _ctx: 컨텍스트
	public async Activate(_ctx: IPluginContext): Promise<void>
	{
		this.context_ = _ctx;
		await this.OnActivate(_ctx);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 비활성화한다. 매니저 전용.
	public async Deactivate(): Promise<void>
	{
		await this.OnDeactivate();
		this.context_ = null;
	}

	// ==================== 확장점 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 활성화 본체. Tool·Command 등록 지점.
	// @param _ctx: 컨텍스트
	protected abstract OnActivate(_ctx: IPluginContext): void | Promise<void>;

	//////////////////////////////////////////////////////////////////////////////////////
	// 비활성화 본체.
	protected OnDeactivate(): void | Promise<void>
	{
		// 의도적 빈 구현.
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 컨텍스트를 구한다. Activate 전이면 throw.
	protected Context(): IPluginContext
	{
		if (this.context_ === null)
			throw new Error("[PluginBase] Activate 전");
		return this.context_;
	}
}
