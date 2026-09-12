/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: FileLogSink. app-YYYYMMDD.log 일별 + 7일 보관.
*/

import * as path from "node:path";
import { promises as fs } from "node:fs";
import type { ILogEntry } from "@scouter/gui";

export class FileLogSink
{
	// ==================== 멤버 ====================
	private readonly dir_: string;
	private readonly retainDays_: number;
	private readonly clock_: () => number;
	private queue_: string[] = [];
	private flushing_ = false;
	private currentDay_ = "";

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 폴더로 만든다.
	// @param _dir: 로그 폴더
	// @param _retainDays: 보관일 (기본 7)
	// @param _clock: 시계 (미지정 시 실제 시간)
	public constructor(_dir: string, _retainDays = 7, _clock?: () => number)
	{
		this.dir_ = _dir;
		this.retainDays_ = _retainDays;
		this.clock_ = _clock ?? (() => Date.now());
	}

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 1건을 큐에 넣고 500ms 안에 쓴다.
	// @param _entry: 항목
	public Write(_entry: ILogEntry): void
	{
		this.queue_.push(`${new Date(_entry.Ts).toISOString()} [${_entry.Level}] ${_entry.Scope} ${_entry.Msg}${_entry.Data !== undefined ? ` ${JSON.stringify(_entry.Data)}` : ""}\n`);
		if (!this.flushing_)
		{
			this.flushing_ = true;
			setTimeout(() =>
			{
				void this.FlushAsync();
			}, 500);
		}
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 큐를 파일에 붙인다. 날짜 바뀌면 회전.
	private async FlushAsync(): Promise<void>
	{
		const batch = this.queue_;
		this.queue_ = [];
		this.flushing_ = false;
		if (batch.length === 0)
			return;
		const day = new Date(this.clock_()).toISOString().slice(0, 10).replace(/-/g, "");
		try
		{
			await fs.mkdir(this.dir_, { recursive: true });
			await fs.appendFile(path.join(this.dir_, `app-${day}.log`), batch.join(""));
			if (this.currentDay_ !== "" && this.currentDay_ !== day)
				void this.SweepAsync();
			this.currentDay_ = day;
		}
		catch
		{
			// 로그 기록 실패는 무시(앱 동작 우선).
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 보관일 지난 파일을 지운다. 파일명 날짜 기준.
	private async SweepAsync(): Promise<void>
	{
		try
		{
			const now = this.clock_();
			const files = await fs.readdir(this.dir_);
			for (const file of files)
			{
				const match = /^app-(\d{8})\.log$/.exec(file);
				if (match === null)
					continue;
				const stamp = match[1] as string;
				const dayMs = Date.parse(`${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 8)}T00:00:00Z`);
				if (Number.isNaN(dayMs))
					continue;
				if (dayMs + this.retainDays_ * 86400000 <= now)
					await fs.unlink(path.join(this.dir_, file));
			}
		}
		catch
		{
			// 정리 실패는 무시.
		}
	}
}
