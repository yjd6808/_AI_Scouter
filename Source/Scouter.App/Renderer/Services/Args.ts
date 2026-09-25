/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: Renderer 실행 인자. Main이 additionalArguments로 전달한 argv를 파싱한다.
*/

export class Args
{
	// ==================== 정적 ====================
	private static s_test_ = false;
	private static s_noAuth_ = false;
	private static s_hidden_ = false;
	private static s_safe_ = false;
	private static s_layoutDir_: string | null = null;
	private static s_pluginDir_: string | null = null;
	private static s_port_: number | null = null;
	private static s_multi_ = false;

	// ==================== 속성 ====================
	public static get IsTest(): boolean { return Args.s_test_; }
	public static get NoAuth(): boolean { return Args.s_noAuth_; }
	public static get Hidden(): boolean { return Args.s_hidden_; }
	public static get Safe(): boolean { return Args.s_safe_; }
	public static get LayoutDir(): string | null { return Args.s_layoutDir_; }
	public static get PluginDir(): string | null { return Args.s_pluginDir_; }
	public static get Port(): number | null { return Args.s_port_; }
	public static get Multi(): boolean { return Args.s_multi_; }

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// argv를 파싱해 정적 상태에 저장한다.
	// @param _argv: process.argv
	public static Parse(_argv: string[]): void
	{
		for (let idx = 0; idx < _argv.length; ++idx)
		{
			const token = _argv[idx];
			if (token === "--test")
				Args.s_test_ = true;
			else if (token === "--no-auth")
				Args.s_noAuth_ = true;
			else if (token === "--hidden")
				Args.s_hidden_ = true;
			else if (token === "--safe")
				Args.s_safe_ = true;
			else if (token === "--layout-dir")
				Args.s_layoutDir_ = _argv[++idx] ?? null;
			else if (token === "--plugin-dir")
				Args.s_pluginDir_ = _argv[++idx] ?? null;
			else if (token === "--port")
				Args.s_port_ = Number(_argv[++idx] ?? NaN) || null;
			else if (token === "-multi" || token === "--multi")
				Args.s_multi_ = true;
		}
	}
}
