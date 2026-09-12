/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: MainLog. Main 프로세스 일별 로그 + 보관·상한.
*/

import * as fs from "node:fs";
import * as path from "node:path";

export interface IMainLogClock
{
	Now(): number;
}

const kMsPerDay = 86400000;

export class MainLog
{
	// ==================== 멤버 ====================
	private readonly dir_: string;
	private readonly retainDays_: number;
	private readonly maxBytesPerDay_: number;
	private readonly clock_: IMainLogClock;

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 폴더·보관·상한으로 만든다.
	// @param _dir: 로그 폴더
	// @param _retainDays: 보관일
	// @param _maxBytesPerDay: 일별 상한 바이트
	// @param _clock: 시계 (미지정 시 실제 시간)
	public constructor(_dir: string, _retainDays = 7, _maxBytesPerDay = 20 * 1024 * 1024, _clock?: IMainLogClock)
	{
		this.dir_ = _dir;
		this.retainDays_ = _retainDays;
		this.maxBytesPerDay_ = _maxBytesPerDay;
		this.clock_ = _clock ?? { Now: () => Date.now() };
	}

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 정보 1건을 쓴다.
	// @param _scope: 영역
	// @param _msg: 메시지
	public Info(_scope: string, _msg: string): void
	{
		this.Write("info", _scope, _msg);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 경고 1건을 쓴다.
	// @param _scope: 영역
	// @param _msg: 메시지
	public Warn(_scope: string, _msg: string): void
	{
		this.Write("warn", _scope, _msg);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 오류 1건을 쓴다.
	// @param _scope: 영역
	// @param _msg: 메시지
	public Error(_scope: string, _msg: string): void
	{
		this.Write("error", _scope, _msg);
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 일별 파일에 붙인다. 상한 초과·날짜 변경 시 회전.
	// @param _level: 수준
	// @param _scope: 영역
	// @param _msg: 메시지
	private Write(_level: string, _scope: string, _msg: string): void
	{
		try
		{
			fs.mkdirSync(this.dir_, { recursive: true });
			const day = new Date(this.clock_.Now()).toISOString().slice(0, 10).replace(/-/g, "");
			const full = path.join(this.dir_, `main-${day}.log`);
			let size = 0;
			try
			{
				size = fs.statSync(full).size;
			}
			catch
			{
				size = 0;
			}
			if (size >= this.maxBytesPerDay_)
				return;
			const line = `${new Date(this.clock_.Now()).toISOString()} [${_level}] ${_scope} ${_msg}\n`;
			fs.appendFileSync(full, line, "utf-8");
			this.Sweep();
		}
		catch
		{
			// 로그 기록 실패는 무시(앱 동작 우선).
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 보관일 지난 main-YYYYMMDD.log를 지운다. 파일명 날짜 기준.
	private Sweep(): void
	{
		try
		{
			const now = this.clock_.Now();
			for (const file of fs.readdirSync(this.dir_))
			{
				const match = /^main-(\d{8})\.log$/.exec(file);
				if (match === null)
					continue;
				const stamp = match[1] as string;
				const dayMs = Date.parse(`${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 8)}T00:00:00Z`);
				if (Number.isNaN(dayMs))
					continue;
				if (dayMs + this.retainDays_ * kMsPerDay <= now)
					fs.unlinkSync(path.join(this.dir_, file));
			}
		}
		catch
		{
			// 정리 실패는 무시.
		}
	}
}
