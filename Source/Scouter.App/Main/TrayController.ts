/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: TrayController. 트레이 아이콘·메뉴·MCP 상태.
*/

import { Tray, Menu, nativeImage } from "electron";

export interface ITrayCallbacks
{
	OnOpen(): void;
	OnSettings(): void;
	OnCheckUpdate(): void;
	OnQuit(): void;
	StatusText(): string;
}

export class TrayController
{
	// ==================== 멤버 ====================
	private tray_: Tray | null = null;
	private callbacks_: ITrayCallbacks | null = null;

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 트레이를 만든다. 클릭이면 창 토글.
	// @param _iconPath: 아이콘 경로 (없으면 빈 이미지)
	// @param _callbacks: 메뉴 동작
	public Create(_iconPath: string, _callbacks: ITrayCallbacks): void
	{
		this.callbacks_ = _callbacks;
		let image = nativeImage.createEmpty();
		try
		{
			const loaded = nativeImage.createFromPath(_iconPath);
			if (!loaded.isEmpty())
				image = loaded;
		}
		catch
		{
			// 빈 이미지로 진행.
		}
		const tray = new Tray(image);
		tray.setToolTip("Scouter");
		tray.on("click", () => { this.callbacks_?.OnOpen(); });
		tray.setContextMenu(this.BuildMenu());
		this.tray_ = tray;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 툴팁을 바꾼다.
	// @param _text: 문구
	public SetTooltip(_text: string): void
	{
		this.tray_?.setToolTip(_text);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// MCP 상태를 메뉴에 반영한다.
	// @param _sessions: 세션 수
	public SetMcpState(_sessions: number): void
	{
		this.tray_?.setContextMenu(this.BuildMenu(`실행 중 · 세션 ${_sessions}`));
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 트레이를 걷는다.
	public Dispose(): void
	{
		this.tray_?.destroy();
		this.tray_ = null;
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 메뉴를 만든다.
	// @param _status: 상태 줄
	private BuildMenu(_status = "실행 중"): Menu
	{
		const callbacks = this.callbacks_;
		return Menu.buildFromTemplate([
			{
				label: "Scouter 열기", click: () => { callbacks?.OnOpen(); },
			},
			{ type: "separator" },
			{ label: `MCP: ${_status}`, enabled: false },
			{
				label: "설정…", click: () => { callbacks?.OnSettings(); },
			},
			{
				label: "업데이트 확인", click: () => { callbacks?.OnCheckUpdate(); },
			},
			{ type: "separator" },
			{
				label: "종료", click: () => { callbacks?.OnQuit(); },
			},
		]);
	}
}
