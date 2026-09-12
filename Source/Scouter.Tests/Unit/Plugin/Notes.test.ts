/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: Notes 저장소·인자 테스트. 전부 가짜 fs.
*/

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { NoteStore, Slugify } from "../../../../Plugins/Notes/NoteStore";
import { AppendTool } from "../../../../Plugins/Notes/Tools/AppendTool";
import { ReadTool } from "../../../../Plugins/Notes/Tools/ReadTool";
import { ListTool } from "../../../../Plugins/Notes/Tools/ListTool";
import { SearchTool } from "../../../../Plugins/Notes/Tools/SearchTool";

function MemoryFs(): { files: Map<string, string>; Fs: { ReadText(_p: string): Promise<string>; WriteText(_p: string, _t: string): Promise<void>; ReadDir(_p: string): Promise<string[]>; Exists(_p: string): Promise<boolean> } }
{
	const files = new Map<string, string>();
	return {
		files: files,
		Fs: {
			ReadText: (_p) =>
			{
				const found = files.get(_p);
				return found === undefined ? Promise.reject(new Error("없음")) : Promise.resolve(found);
			},
			WriteText: (_p, _t) =>
			{
				files.set(_p, _t);
				return Promise.resolve();
			},
			ReadDir: (_p) => Promise.resolve([...files.keys()].filter((_k) => _k.startsWith(_p)).map((_k) => _k.slice(_p.length + 1))),
			Exists: (_p) => Promise.resolve(files.has(_p)),
		},
	};
}

function Call(): { SessionId: string; Progress(_n: number, _msg: string): void; Signal: AbortSignal; Log(_msg: string): void }
{
	return { SessionId: "t", Progress: () => undefined, Signal: new AbortController().signal, Log: () => undefined };
}

void describe("Notes", () =>
{
	void it("Slugify 소문자·구분자·탈출 거부", () =>
	{
		assert.equal(Slugify("Mabinogi Release 1"), "mabinogi-release-1");
		assert.throws(() => { Slugify(".."); });
		assert.throws(() => { Slugify("   "); });
	});

	void it("추가·읽기·목록", async () =>
	{
		const mem = MemoryFs();
		const store = new NoteStore(mem.Fs, "/notes");
		assert.equal(await store.ReadAsync("inbox"), "");
		await store.AppendAsync("inbox", "첫 메모");
		await store.AppendAsync("inbox", "둘째 줄\n개행은 공백");
		const text = await store.ReadAsync("inbox");
		assert.ok(text.includes("첫 메모") && text.includes("둘째 줄 개행은 공백"));
		const listed = await store.ListAsync();
		assert.equal(listed.length, 1);
		assert.equal(listed[0]?.Name, "inbox");
	});

	void it("Tool 인자 검증·기본 노트", async () =>
	{
		const mem = MemoryFs();
		const store = new NoteStore(mem.Fs, "/notes");
		const append = new AppendTool(store, () => "inbox");
		await assert.rejects(append.Run({ Text: "  " }, Call()));
		const done = await append.Run({ Text: "할 일" }, Call()) as { Note?: string };
		assert.equal(done.Note, "inbox");
		const read = new ReadTool(store);
		await assert.rejects(read.Run({}, Call()));
		const back = await read.Run({ Note: "inbox" }, Call()) as { Text?: string };
		assert.ok((back.Text ?? "").includes("할 일"));
		const listed = await new ListTool(store).Run({}, Call()) as { Notes?: Array<{ Name?: string }> };
		assert.equal(listed.Notes?.length, 1);
		const found = await new SearchTool(store).Run({ Query: "할 일" }, Call()) as { Matches?: Array<{ Note?: string }> };
		assert.equal(found.Matches?.length, 1);
		const first = (found.Matches ?? [])[0];
		assert.equal(first?.Note, "inbox");
		await assert.rejects(new SearchTool(store).Run({}, Call()));
	});
});
