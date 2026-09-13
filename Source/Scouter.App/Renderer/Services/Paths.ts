/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: Paths. IPC app:get-paths 1회 후 캐시 + 파생 경로.
*/

import * as path from "node:path";

export interface IAppPaths
{
	UserData: string;
	Home: string;
	Exe: string;
	AppPath: string;
	Resources: string;
	Logs: string;
	Temp: string;
	Version: string;
	IsPackaged: boolean;
	Args: string[];
}

export class Paths
{
	// ==================== 정적 ====================
	private static s_paths_: IAppPaths | null = null;

	// ==================== 속성 ====================
	public static get UserData(): string { return Paths.Require().UserData; }
	public static get Home(): string { return Paths.Require().Home; }
	public static get Logs(): string { return Paths.Require().Logs; }
	public static get Temp(): string { return Paths.Require().Temp; }
	public static get Version(): string { return Paths.Require().Version; }
	public static get IsPackaged(): boolean { return Paths.Require().IsPackaged; }
	public static get Args(): string[] { return Paths.Require().Args; }
	public static get AppPath(): string { return Paths.Require().AppPath; }
	public static get Resources(): string { return Paths.Require().Resources; }
	public static get ScouterHome(): string { return `${Paths.UserData}/.scouter`; }
	public static get LogsDir(): string { return `${Paths.ScouterHome}/logs`; }
	public static get SettingsFile(): string { return `${Paths.ScouterHome}/settings.json`; }

	//////////////////////////////////////////////////////////////////////////////////////
	// exe가 든 폴더를 구한다. 모르면 빈 문자열.
	public static get ExeDir(): string
	{
		const exe = Paths.Require().Exe;
		return exe.length > 0 ? path.dirname(exe) : "";
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 배포판 외부 Plugin 폴더를 구한다. 패키징일 때만. 없으면 null.
	public static get ExePluginDir(): string | null
	{
		if (!Paths.Require().IsPackaged)
			return null;
		const dir = Paths.ExeDir;
		return dir.length > 0 ? path.join(dir, "Plugins") : null;
	}

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// Main에 경로를 묻고 캐시한다. 실패하면 임시값.
	public static async Init(): Promise<void>
	{
		if (Paths.s_paths_ !== null)
			return;
		try
		{
			// eslint-disable-next-line @typescript-eslint/no-require-imports
			const electron = require("electron") as { ipcRenderer?: { invoke(_c: string): Promise<IAppPaths> } };
			Paths.s_paths_ = await electron.ipcRenderer?.invoke("app:get-paths") ?? Paths.Fallback();
		}
		catch
		{
			Paths.s_paths_ = Paths.Fallback();
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 테스트용 주입.
	// @param _paths: 경로
	public static Inject(_paths: IAppPaths): void
	{
		Paths.s_paths_ = _paths;
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// Main이 없을 때 임시값.
	private static Fallback(): IAppPaths
	{
		const tmp = process.env["TEMP"] ?? process.env["TMPDIR"] ?? "/tmp";
		return { UserData: tmp, Home: tmp, Exe: "", AppPath: "", Resources: "", Logs: tmp, Temp: tmp, Version: "0.4.0", IsPackaged: false, Args: process.argv };
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 캐시 읽기. 미초기화면 예외.
	private static Require(): IAppPaths
	{
		if (Paths.s_paths_ === null)
			throw new Error("[Paths] Init 필요");
		return Paths.s_paths_;
	}
}
