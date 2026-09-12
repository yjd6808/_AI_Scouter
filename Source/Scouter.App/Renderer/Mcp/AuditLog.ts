/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: AuditLog. JSONL append + 20MB 회전.
*/

import { promises as fs } from "node:fs";
import * as path from "node:path";

export interface IAuditEntry
{
	At: string;
	Session: string;
	Client: string;
	Tool: string;
	ArgsSummary: string;
	Decision: string;
	DurationMs: number;
	Ok: boolean;
}

export class AuditLog
{
	// ==================== 정적 ====================
	private static s_dir_ = "";
	private static s_enabled_ = true;
	private static s_maxBytes_ = 20 * 1024 * 1024;

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 출력 폴더를 정한다.
	// @param _dir: 로그 폴더
	// @param _maxMb: 회전 크기 MB
	public static Init(_dir: string, _maxMb: number): void
	{
		AuditLog.s_dir_ = _dir;
		AuditLog.s_maxBytes_ = _maxMb * 1024 * 1024;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 1건을 적는다. 실패해도 호출자에 영향 없음.
	// @param _entry: 항목
	public static Append(_entry: IAuditEntry): void
	{
		if (!AuditLog.s_enabled_ || AuditLog.s_dir_.length === 0)
			return;
		void AuditLog.WriteAsync(_entry);
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 파일에 붙인다. 크기 넘으면 롤링.
	// @param _entry: 항목
	private static async WriteAsync(_entry: IAuditEntry): Promise<void>
	{
		try
		{
			await fs.mkdir(AuditLog.s_dir_, { recursive: true });
			const file = path.join(AuditLog.s_dir_, "mcp-audit.jsonl");
			await fs.appendFile(file, `${JSON.stringify(_entry)}\n`, "utf-8");
			const stat = await fs.stat(file);
			if (stat.size > AuditLog.s_maxBytes_)
				await fs.rename(file, path.join(AuditLog.s_dir_, `mcp-audit-${Date.now()}.jsonl`));
		}
		catch
		{
			// 감사 실패는 무시.
		}
	}
}
