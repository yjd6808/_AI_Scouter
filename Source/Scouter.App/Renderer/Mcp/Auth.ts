/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: Auth. Bearer 토큰 발급·검증. timingSafeEqual 비교.
*/

import * as crypto from "node:crypto";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import type { IncomingMessage } from "node:http";

export class Auth
{
	// ==================== 멤버 ====================
	private token_ = "";
	private readonly dir_: string;

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 토큰 폴더로 만든다.
	// @param _dir: ~/.scouter 폴더
	public constructor(_dir: string)
	{
		this.dir_ = _dir;
	}

	// ==================== 속성 ====================
	public get Token(): string { return this.token_; }

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 토큰을 읽거나 새로 만든다. 파일 0600.
	public async InitAsync(): Promise<void>
	{
		const file = path.join(this.dir_, "mcp-token");
		try
		{
			const saved = (await fs.readFile(file, "utf-8")).trim();
			if (saved.length > 0)
			{
				this.token_ = saved;
				return;
			}
		}
		catch
		{
			// 없으면 생성.
		}
		await this.RegenerateAsync();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 토큰을 재발급한다. 호출자가 세션을 끊는다.
	public async RegenerateAsync(): Promise<string>
	{
		this.token_ = crypto.randomBytes(32).toString("base64url");
		const file = path.join(this.dir_, "mcp-token");
		await fs.mkdir(this.dir_, { recursive: true });
		await fs.writeFile(file, this.token_, { encoding: "utf-8", mode: 0o600 });
		return this.token_;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 요청을 검증한다. --no-auth면 항상 통과.
	// @param _req: 요청
	// @param _noAuth: 개발 모드
	public Verify(_req: IncomingMessage, _noAuth: boolean): boolean
	{
		if (_noAuth)
			return true;
		const header = _req.headers.authorization ?? "";
		if (!header.startsWith("Bearer "))
			return false;
		const given = Buffer.from(header.slice("Bearer ".length));
		const want = Buffer.from(this.token_);
		if (given.length !== want.length)
			return false;
		return crypto.timingSafeEqual(given, want);
	}
}
