/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: Fs. fs/promises 래퍼. 경로 샌드박스는 Plugin Context(P6)에서 검사.
*/

import { promises as fs } from "node:fs";
import { dirname } from "node:path";

export class Fs
{
	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 텍스트를 읽는다.
	// @param _path: 경로
	public static async ReadText(_path: string): Promise<string>
	{
		return fs.readFile(_path, "utf-8");
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 텍스트를 쓴다. 폴더는 자동 생성.
	// @param _path: 경로
	// @param _text: 내용
	public static async WriteText(_path: string, _text: string): Promise<void>
	{
		await fs.mkdir(dirname(_path), { recursive: true });
		await fs.writeFile(_path, _text, "utf-8");
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 폴더 목록을 읽는다.
	// @param _path: 폴더
	public static async ReadDir(_path: string): Promise<string[]>
	{
		return fs.readdir(_path);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 존재 여부를 본다.
	// @param _path: 경로
	public static async Exists(_path: string): Promise<boolean>
	{
		try
		{
			await fs.access(_path);
			return true;
		}
		catch
		{
			return false;
		}
	}
}
