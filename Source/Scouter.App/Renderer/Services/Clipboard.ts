/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: Clipboard. electron.clipboard 래퍼.
*/

interface IClipboardApi
{
	writeText(_text: string): void;
	readText(): string;
}

function Api(): IClipboardApi | null
{
	try
	{
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const electron = require("electron") as { clipboard?: IClipboardApi };
		return electron.clipboard ?? null;
	}
	catch
	{
		return null;
	}
}

export class Clipboard
{
	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 텍스트를 쓴다. Main 없으면 false.
	// @param _text: 텍스트
	public static WriteText(_text: string): boolean
	{
		try
		{
			Api()?.writeText(_text);
			return true;
		}
		catch
		{
			return false;
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 텍스트를 읽는다. Main 없으면 빈 문자열.
	public static ReadText(): string
	{
		try
		{
			return Api()?.readText() ?? "";
		}
		catch
		{
			return "";
		}
	}
}
