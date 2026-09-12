/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: UserControl. Shell 콘텐츠에 끼우는 조각. Host Window에 붙어야 보인다.
*/

import type { Window } from "./Window";
import { ContentControl } from "../Controls/ContentControl";
import { DataList } from "../Xml/DataList";

export class UserControl extends ContentControl
{
	// ==================== 멤버 ====================
	public readonly DataList = new DataList();
	private host_: Window | null = null;
	private pluginId_: string | undefined = undefined;

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 조각 div를 만든다.
	public constructor()
	{
		super();
		this.Element.classList.add("gui-usercontrol");
	}

	// ==================== 속성 ====================
	public get Host(): Window | null { return this.host_; }
	public get PluginId(): string | undefined { return this.pluginId_; }
	public set PluginId(_v: string | undefined) { this.pluginId_ = _v; }

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// UIManager 전용. 부착 처리.
	// @param _host: 호스트 창
	// @param _data: 초기 데이터
	public AttachToManager(_host: Window, _data: DataList): void
	{
		this.host_ = _host;
		this.OnInit(_data);
		this.OnAttached(_host);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// UIManager 전용. 분리 처리. 캐시 생존이므로 Dispose 안 함.
	public DetachFromManager(): void
	{
		this.OnDetached();
		this.host_ = null;
	}

	// ==================== 확장점 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 로더 완료 직후.
	// @param _data: 바인딩 소스
	protected OnInit(_data: DataList): void
	{
		// 의도적 빈 구현. 하위 클래스 확장점.
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 호스트에 붙은 후.
	// @param _host: 호스트 창
	protected OnAttached(_host: Window): void
	{
		// 의도적 빈 구현. 하위 클래스 확장점.
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 호스트에서 떨어진 후.
	protected OnDetached(): void
	{
		// 의도적 빈 구현. 하위 클래스 확장점.
	}
}
