/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: @scouter/harness 진입점. Test API(/test/*) 위의 얇은 클라이언트다.
*/

export interface IHarnessOptions
{
	Port?: number;
}

async function WaitMs(_ms: number): Promise<void>
{
	return new Promise((_resolve) => setTimeout(_resolve, _ms));
}

export class Harness
{
	// ==================== 정적 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 포트만으로 하네스를 만든다. 기동은 호출자가 담당한다.
	// @param _opts: 옵션
	public static async Launch(_opts: IHarnessOptions): Promise<Harness>
	{
		const app = new Harness(_opts.Port ?? 9515);
		await app.WaitReady();
		return app;
	}

	// ==================== 멤버 ====================
	private readonly baseUrl_: string;

	// ==================== 생성 · 소멸 ====================
	//////////////////////////////////////////////////////////////////////////////////////
	// TODO: 설명
	public constructor(_port: number)
	{
		this.baseUrl_ = `http://127.0.0.1:${_port}`;
	}

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 준비될 때까지 /test/ping을 폴링한다.
	public async WaitReady(): Promise<void>
	{
		for (let idx = 0; idx < 100; ++idx)
		{
			try
			{
				const res = await fetch(`${this.baseUrl_}/test/ping`);
				if (res.ok)
					return;
			}
			catch
			{
				await WaitMs(200);
			}
		}
		throw new Error("[Harness] ping 타임아웃");
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 트리를 조회한다.
	public async Tree(): Promise<unknown>
	{
		const res = await fetch(`${this.baseUrl_}/test/tree`);
		return res.json();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 종료를 요청한다. P0에는 라우트가 없어 실패해도 무시한다.
	public async Quit(): Promise<void>
	{
		try
		{
			await fetch(`${this.baseUrl_}/test/quit`, { method: "POST" });
		}
		catch
		{
			return;
		}
	}
}
