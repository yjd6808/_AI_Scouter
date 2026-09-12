/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: CrashReporter. 미처리 예외를 crash JSON으로 남긴다.
*/

import * as fs from "node:fs";
import * as path from "node:path";

export interface ICrashPayload
{
	Kind: string;
	Message: string;
	Stack: string;
	At: string;
	Recent: string[];
}

export class CrashReporter
{
	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 충돌 페이로드를 만든다.
	// @param _kind: 종류
	// @param _err: 예외
	// @param _recent: 최근 로그 꼬리
	public static Format(_kind: string, _err: unknown, _recent: string[]): ICrashPayload
	{
		const message = _err instanceof Error ? _err.message : String(_err);
		const stack = _err instanceof Error ? _err.stack ?? "" : "";
		return { Kind: _kind, Message: message, Stack: stack, At: new Date().toISOString(), Recent: _recent.slice(-200) };
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 충돌 파일을 쓴다. 경로를 돌려준다.
	// @param _dir: 로그 폴더
	// @param _payload: 페이로드
	public static WriteCrash(_dir: string, _payload: ICrashPayload): string
	{
		fs.mkdirSync(_dir, { recursive: true });
		const stamp = _payload.At.replace(/[:.]/g, "-");
		const full = path.join(_dir, `crash-${stamp}.json`);
		fs.writeFileSync(full, JSON.stringify(_payload, null, 2), "utf-8");
		return full;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 프로세스 핸들러를 건다. 원격 전송 없음.
	// @param _dir: 로그 폴더
	// @param _tail: 최근 로그 제공자
	public static Install(_dir: string, _tail: () => string[]): void
	{
		process.on("uncaughtException", (_err) =>
		{
			try
			{
				CrashReporter.WriteCrash(_dir, CrashReporter.Format("uncaughtException", _err, _tail()));
			}
			catch
			{
				// 무시.
			}
			process.exit(1);
		});
		process.on("unhandledRejection", (_reason) =>
		{
			try
			{
				CrashReporter.WriteCrash(_dir, CrashReporter.Format("unhandledRejection", _reason, _tail()));
			}
			catch
			{
				// 무시.
			}
		});
	}
}
