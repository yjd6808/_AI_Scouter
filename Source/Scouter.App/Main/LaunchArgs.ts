/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: Main 프로세스 실행 인자. Renderer에는 additionalArguments로 동일하게 전달된다.
*/

export class LaunchArgs
{
	// ==================== 멤버 ====================
	public Test = false;
	public Hidden = false;
	public NoAuth = false;
	public Safe = false;
	public LayoutDir: string | null = null;
	public PluginDir: string | null = null;
	public Port: number | null = null;
	public readonly Raw: string[];

	// ==================== 생성 · 소멸 ====================
	//////////////////////////////////////////////////////////////////////////////////////
	// TODO: 설명
	public constructor(_raw: string[])
	{
		this.Raw = _raw;
	}

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// argv에서 플래그를 읽는다.
	// @param _argv: process.argv 전체
	public static Parse(_argv: string[]): LaunchArgs
	{
		const args = new LaunchArgs(_argv);
		for (let idx = 0; idx < _argv.length; ++idx)
		{
			const token = _argv[idx];
			if (token === "--test")
				args.Test = true;
			else if (token === "--hidden")
				args.Hidden = true;
			else if (token === "--no-auth")
				args.NoAuth = true;
			else if (token === "--safe")
				args.Safe = true;
			else if (token === "--layout-dir")
				args.LayoutDir = _argv[++idx] ?? null;
			else if (token === "--plugin-dir")
				args.PluginDir = _argv[++idx] ?? null;
			else if (token === "--port")
			{
				const port = Number(_argv[++idx] ?? NaN);
				args.Port = Number.isNaN(port) ? null : port;
			}
		}
		return args;
	}
}
