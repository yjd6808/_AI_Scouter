/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: CallLogBuffer. 최근 2000 호출 링 버퍼.
*/

export interface IToolCallEntry
{
	At: string;
	Session: string;
	Client: string;
	Tool: string;
	Decision: string;
	DurationMs: number;
	Ok: boolean;
}

export class CallLogBuffer
{
	// ==================== 정적 ====================
	private static readonly s_items_: IToolCallEntry[] = [];
	private static readonly s_capacity_ = 2000;

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 1건을 쌓는다.
	// @param _entry: 항목 (부분 허용)
	public static Push(_entry: { At?: string; Tool?: string; Session?: string; Client?: string; Decision?: string; DurationMs?: number; Ok?: boolean }): void
	{
		CallLogBuffer.s_items_.push({
			At: _entry.At ?? new Date().toISOString(),
			Session: _entry.Session ?? "",
			Client: _entry.Client ?? "",
			Tool: _entry.Tool ?? "",
			Decision: _entry.Decision ?? "",
			DurationMs: _entry.DurationMs ?? 0,
			Ok: _entry.Ok ?? true,
		});
		while (CallLogBuffer.s_items_.length > CallLogBuffer.s_capacity_)
			CallLogBuffer.s_items_.shift();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 스냅샷을 반환한다. 새→오래 역순.
	// @param _filter: Tool 부분 문자열
	// @param _onlyFailed: 실패만
	public static Snapshot(_filter: string, _onlyFailed: boolean): IToolCallEntry[]
	{
		const out: IToolCallEntry[] = [];
		for (let idx = CallLogBuffer.s_items_.length - 1; idx >= 0; --idx)
		{
			const entry = CallLogBuffer.s_items_[idx] as IToolCallEntry;
			if (_filter.length > 0 && !entry.Tool.includes(_filter))
				continue;
			if (_onlyFailed && entry.Ok)
				continue;
			out.push(entry);
		}
		return out;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 전부 지운다.
	public static Clear(): void
	{
		CallLogBuffer.s_items_.length = 0;
	}
}
