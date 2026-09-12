/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: UpdateController. electron-updater generic 확인·설치.
*/

import { autoUpdater } from "electron-updater";
import { Cron } from "croner";
import type { IUpdateStatus } from "../Shared/IpcChannels";

export class UpdateController
{
	// ==================== 멤버 ====================
	private readonly notify_: (_status: IUpdateStatus) => void;
	private channel_ = "stable";
	private url_ = "";
	private started_ = false;
	private cron_: Cron | null = null;

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 상태 통지로 만든다.
	// @param _notify: 상태 전송자
	public constructor(_notify: (_status: IUpdateStatus) => void)
	{
		this.notify_ = _notify;
		autoUpdater.autoDownload = true;
		autoUpdater.on("checking-for-update", () => { this.notify_({ State: "checking" }); });
		autoUpdater.on("update-available", (_info) => { this.notify_({ State: "downloading", Version: _info.version }); });
		autoUpdater.on("download-progress", (_progress) => { this.notify_({ State: "downloading", Percent: Math.round(_progress.percent) }); });
		autoUpdater.on("update-downloaded", (_info) => { this.notify_({ State: "ready", Version: _info.version }); });
		autoUpdater.on("error", (_err) => { this.notify_({ State: "error", Message: UpdateController.MessageOf(_err) }); });
	}

	// ==================== 속성 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 켜짐 여부. 채널·URL이 다 있어야 한다.
	private get Enabled(): boolean
	{
		return this.channel_ !== "none" && this.url_.length > 0;
	}

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 채널·URL을 굳힌다. none이거나 URL이 비면 끔.
	// @param _channel: stable/none
	// @param _url: generic 주소
	public Configure(_channel: string, _url: string): void
	{
		this.channel_ = _channel;
		this.url_ = _url;
		if (this.Enabled)
			autoUpdater.setFeedURL({ provider: "generic", url: _url, channel: _channel });
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 60초 후 첫 확인 + 6시간 간격. 테스트에서는 off.
	// @param _test: 테스트 모드
	public Start(_test: boolean): void
	{
		if (_test || this.started_)
			return;
		this.started_ = true;
		setTimeout(() =>
		{
			void this.CheckAsync();
		}, 60000);
		this.cron_ = new Cron("0 */6 * * *", () =>
		{
			void this.CheckAsync();
		});
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 지금 확인한다. 끔이면 idle.
	public async CheckAsync(): Promise<void>
	{
		if (!this.Enabled)
		{
			this.notify_({ State: "idle" });
			return;
		}
		try
		{
			await autoUpdater.checkForUpdates();
		}
		catch (_e)
		{
			this.notify_({ State: "error", Message: UpdateController.MessageOf(_e) });
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 받고 재시작한다.
	public Install(): void
	{
		autoUpdater.quitAndInstall(true, true);
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 오류 메시지를 굳힌다.
	// @param _e: 예외
	private static MessageOf(_e: unknown): string
	{
		if (_e instanceof Error)
			return _e.message;
		return typeof _e === "string" ? _e : "";
	}
}
