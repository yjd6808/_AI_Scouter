/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: P4Util 파서·추출·러너 테스트. 전부 Fake.
*/

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ZtagParser } from "../../../../Plugins/P4Util/ZtagParser";
import { P4Runner, P4Error } from "../../../../Plugins/P4Util/P4Runner";
import { ExtractFilesTool, ReadExtractArgs, FilterFiles, DedupeFiles } from "../../../../Plugins/P4Util/Tools/ExtractFilesTool";
import type { IP4Runner, IChangeInfo, IDescribeInfo, IFileEntry, IP4Settings } from "../../../../Plugins/P4Util/Types";

function Settings(): IP4Settings
{
	return { Port: "", User: "", Client: "", Charset: "utf8", DescribeBatch: 20, MaxChanges: 2000 };
}

function Call(_signal?: AbortSignal): { SessionId: string; Progress(_n: number, _msg: string): void; Signal: AbortSignal; Log(_msg: string): void }
{
	return { SessionId: "t", Progress: () => undefined, Signal: _signal ?? new AbortController().signal, Log: () => undefined };
}

class FakeRunner implements IP4Runner
{
	public readonly Settings: IP4Settings = Settings();
	public readonly Seen: string[] = [];

	public constructor(_changes: IChangeInfo[] = [], _files: IFileEntry[] = [])
	{
		this.changes_ = _changes;
		this.files_ = _files;
	}

	private readonly changes_: IChangeInfo[];
	private readonly files_: IFileEntry[];

	public Changes(_depot: string, _from: number, _to: number, _signal?: AbortSignal): Promise<IChangeInfo[]>
	{
		_signal?.throwIfAborted();
		this.Seen.push(`changes ${_depot}@${_from},${_to}`);
		return Promise.resolve(this.changes_);
	}

	public Describe(_changes: number[], _signal?: AbortSignal): Promise<IDescribeInfo[]>
	{
		_signal?.throwIfAborted();
		this.Seen.push(`describe ${_changes.join(",")}`);
		return Promise.resolve(_changes.map((_c) => ({ Change: _c, User: "u", Description: "d", Files: this.files_.filter((_f) => _f.Change === _c) })));
	}

	public Opened(): Promise<[]>
	{
		return Promise.resolve([]);
	}

	public Annotate(): Promise<[]>
	{
		return Promise.resolve([]);
	}

	public Diff2(): Promise<string>
	{
		return Promise.resolve("");
	}

	public LoginStatus(): Promise<boolean>
	{
		return Promise.resolve(true);
	}
}

void describe("P4Util", () =>
{
	void it("ZtagParser 반복·여러줄·CRLF", () =>
	{
		assert.deepEqual(ZtagParser.Parse(""), []);
		const parsed = ZtagParser.Parse(
			"... change 88123\r\n... user yoon\r\n... desc 첫 줄\r\n둘째 줄\r\n\r\n" +
			"... depotFile0 //d/a.cpp\r\n... depotFile1 //d/b.h\r\n... rev0 3\r\n... rev1 1\r\n",
		);
		assert.equal(parsed.length, 2);
		assert.equal((parsed[0] as Record<string, unknown>)["change"], "88123");
		assert.equal((parsed[0] as Record<string, unknown>)["desc"], "첫 줄\n둘째 줄");
		assert.deepEqual((parsed[1] as Record<string, unknown>)["depotFile"], ["//d/a.cpp", "//d/b.h"]);
		assert.deepEqual((parsed[1] as Record<string, unknown>)["rev"], ["3", "1"]);
	});

	void it("추출 인자·필터·중복제거", () =>
	{
		assert.throws(() => { ReadExtractArgs({ Depot: "", From: 1, To: 2 }); });
		assert.throws(() => { ReadExtractArgs({ Depot: "//d/...", From: 5, To: 2 }); });
		const args = ReadExtractArgs({ Depot: "//d/...", From: 1, To: 40, Actions: ["edit"], Ext: ".cpp;.h", Dedupe: true });
		assert.deepEqual(args.Ext, [".cpp", ".h"]);
		const files: IFileEntry[] = [
			{ DepotPath: "//d/a.cpp", Rev: 2, Action: "edit", Change: 1, Type: "text" },
			{ DepotPath: "//d/a.cpp", Rev: 5, Action: "edit", Change: 2, Type: "text" },
			{ DepotPath: "//d/b.txt", Rev: 1, Action: "add", Change: 1, Type: "text" },
		];
		const filtered = FilterFiles(files, args);
		assert.equal(filtered.length, 2);
		const deduped = DedupeFiles(filtered);
		assert.equal(deduped.length, 1);
		assert.equal(deduped[0]?.Rev, 5);
	});

	void it("ExtractFiles 배치·확인·취소", async () =>
	{
		const changes: IChangeInfo[] = [];
		for (let idx = 1; idx <= 45; ++idx)
			changes.push({ Change: 88000 + idx, Date: "", User: "u", Description: "d" });
		const files: IFileEntry[] = changes.map((_c) => ({ DepotPath: `//d/f${_c.Change}.cpp`, Rev: 1, Action: "edit", Change: _c.Change, Type: "text" }));
		const runner = new FakeRunner(changes, files);
		const tool = new ExtractFilesTool(runner);
		const result = await tool.Run({ Depot: "//d/...", From: 1, To: 45 }, Call()) as { Count: number; ChangeCount: number };
		assert.equal(result.Count, 45);
		assert.equal(result.ChangeCount, 45);
		assert.equal(runner.Seen.filter((_s) => _s.startsWith("describe")).length, 3);
		const big = new FakeRunner(changes.map((_c) => ({ ..._c, Change: _c.Change + 100000 })), []);
		big.Settings.MaxChanges = 10;
		const confirm = await new ExtractFilesTool(big).Run({ Depot: "//d/...", From: 1, To: 45 }, Call()) as { NeedsConfirm?: boolean };
		assert.equal(confirm.NeedsConfirm, true);
		const aborted = new AbortController();
		aborted.abort();
		await assert.rejects(tool.Run({ Depot: "//d/...", From: 1, To: 45 }, Call(aborted.signal)));
	});

	void it("P4Runner 오류 분류·매핑", async () =>
	{
		const fail = new P4Runner({ Exec: () => Promise.resolve({ Code: 1, Stdout: "", Stderr: "Perforce password (P4PASSWD) invalid or unset." }) }, Settings());
		assert.equal(await fail.LoginStatus(), false);
		const ok = new P4Runner({
			Exec: (_cmd, _args) =>
			{
				if (_args[1] === "changes")
					return Promise.resolve({ Code: 0, Stdout: "... change 88123\n... user yoon\n... desc hi\n", Stderr: "" });
				return Promise.resolve({ Code: 0, Stdout: "", Stderr: "" });
			},
		}, Settings());
		const changes = await ok.Changes("//d/...", 1, 40);
		assert.equal(changes.length, 1);
		const only = changes[0] as IChangeInfo;
		assert.equal(only.Change, 88123);
		assert.equal(only.User, "yoon");
		const bad = new P4Runner({ Exec: () => Promise.resolve({ Code: 1, Stdout: "", Stderr: "no such file" }) }, Settings());
		await assert.rejects(bad.Changes("//d/...", 1, 2), (_e: unknown) => _e instanceof P4Error && _e.Kind === "CommandFailed");
	});
});
