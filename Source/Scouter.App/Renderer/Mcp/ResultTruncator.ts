/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: ResultTruncator. 64KB 초과 결과를 자르고 요약한다.
*/

export interface IContentBlock
{
	Type: "text" | "image";
	Text?: string;
	Base64?: string;
	MimeType?: string;
}

export interface ITruncatedResult
{
	Content: IContentBlock[];
	Truncated: boolean;
	TotalCount?: number;
}

const kLimitBytes = 64 * 1024;

export class ResultTruncator
{
	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// Tool 결과를 MCP 블록으로 바꾼다. 크면 앞에서 자른다.
	// @param _result: Tool 반환값
	public static Apply(_result: unknown): ITruncatedResult
	{
		if (typeof _result === "object" && _result !== null && Array.isArray((_result as { Content?: unknown }).Content))
		{
			const blocks = (_result as { Content: IContentBlock[] }).Content;
			return { Content: blocks, Truncated: false };
		}
		const text = typeof _result === "string" ? _result : JSON.stringify(_result);
		const bytes = Buffer.byteLength(text, "utf-8");
		if (bytes <= kLimitBytes)
			return { Content: [{ Type: "text", Text: text }], Truncated: false };
		let end = kLimitBytes;
		while (end > 0 && (text.charCodeAt(end) & 0xC0) === 0x80)
			end--;
		const head = text.slice(0, end);
		return {
			Content: [{ Type: "text", Text: `${head}\n…(잘림 ${bytes - Buffer.byteLength(head, "utf-8")}B/${bytes}B)` }],
			Truncated: true,
		};
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 인자 요약을 만든다. 문자열 256자·배열 길이만.
	// @param _args: 인자
	public static Summarize(_args: Record<string, unknown>): string
	{
		const parts: string[] = [];
		for (const [key, value] of Object.entries(_args))
		{
			if (typeof value === "string")
				parts.push(`${key}=${value.slice(0, 256)}`);
			else if (Array.isArray(value))
				parts.push(`${key}=[${value.length}]`);
			else
				parts.push(`${key}=${String(value).slice(0, 64)}`);
		}
		return parts.join(" ");
	}
}
