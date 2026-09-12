/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: ExtractFiles Tool. 범위 변경 파일 목록 + 필터.
*/

import type { ITool, IToolCall } from "@scouter/plugin-api";
import type { IFileEntry, IP4Runner } from "../Types";

const kBatch = 20;
const kPreview = 200;

export interface IExtractArgs
{
	Depot: string;
	From: number;
	To: number;
	Actions: string[];
	Ext: string[];
	Dedupe: boolean;
}

//////////////////////////////////////////////////////////////////////////////////////
// 인자를 읽고 정규화한다.
// @param _args: 원시 인자
export function ReadExtractArgs(_args: Record<string, unknown>): IExtractArgs
{
	const depot = _args["Depot"];
	const from = _args["From"];
	const to = _args["To"];
	if (typeof depot !== "string" || depot.length === 0)
		throw new Error("Depot required");
	if (typeof from !== "number" || typeof to !== "number")
		throw new Error("From/To required");
	if (from > to)
		throw new Error("From이 To보다 크다");
	const actions = _args["Actions"];
	const ext = _args["Ext"];
	const dedupe = _args["Dedupe"];
	return {
		Depot: depot,
		From: Math.floor(from),
		To: Math.floor(to),
		Actions: Array.isArray(actions) ? actions.filter((_a): _a is string => typeof _a === "string") : [],
		Ext: typeof ext === "string" ? ext.split(";").map((_e) => _e.trim()).filter((_e) => _e.length > 0) : [],
		Dedupe: dedupe !== false,
	};
}

//////////////////////////////////////////////////////////////////////////////////////
// 액션·확장자 필터를 건다.
// @param _files: 후보
// @param _args: 조건
export function FilterFiles(_files: IFileEntry[], _args: IExtractArgs): IFileEntry[]
{
	return _files.filter((_f) =>
	{
		if (_args.Actions.length > 0 && !_args.Actions.includes(_f.Action))
			return false;
		if (_args.Ext.length > 0 && !_args.Ext.some((_e) => _f.DepotPath.endsWith(_e)))
			return false;
		return true;
	});
}

//////////////////////////////////////////////////////////////////////////////////////
// 경로 중복을 걷는다. Rev가 큰(나중) 항목 유지.
// @param _files: 후보
export function DedupeFiles(_files: IFileEntry[]): IFileEntry[]
{
	const best = new Map<string, IFileEntry>();
	for (const file of _files)
	{
		const prev = best.get(file.DepotPath);
		if (prev === undefined || file.Rev >= prev.Rev)
			best.set(file.DepotPath, file);
	}
	return [...best.values()];
}

export class ExtractFilesTool implements ITool
{
	// ==================== 멤버 ====================
	public readonly Name = "ExtractFiles";
	public readonly Description = "리비전 범위 변경 파일 목록.";
	public readonly InputSchema = {
		type: "object",
		properties: {
			Depot: { type: "string" }, From: { type: "number" }, To: { type: "number" },
			Actions: { type: "array", items: { type: "string" } }, Ext: { type: "string" },
			Dedupe: { type: "boolean" }, Output: { type: "string" },
		},
		required: ["Depot", "From", "To"],
	};
	public readonly Annotations = { ReadOnly: true };

	private readonly runner_: IP4Runner;
	private readonly emitFile_: ((_name: string, _text: string) => Promise<string>) | null;
	private readonly copyText_: ((_text: string) => void) | null;

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 러너와 출력기로 만든다.
	// @param _runner: 러너
	// @param _emitFile: 파일 출력기(없으면 Screen 강제)
	// @param _copyText: 클립보드 출력기(없으면 Screen 강제)
	public constructor(_runner: IP4Runner, _emitFile?: (_name: string, _text: string) => Promise<string>, _copyText?: (_text: string) => void)
	{
		this.runner_ = _runner;
		this.emitFile_ = _emitFile ?? null;
		this.copyText_ = _copyText ?? null;
	}

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// changes → describe 배치 → 필터 → 출력.
	// @param _args: 인자
	// @param _call: 진행·취소
	public async Run(_args: Record<string, unknown>, _call: IToolCall): Promise<unknown>
	{
		const parsed = ReadExtractArgs(_args);
		const output = _args["Output"];
		_call.Progress(0, "changes 조회");
		const changes = await this.runner_.Changes(parsed.Depot, parsed.From, parsed.To, _call.Signal);
		if (changes.length > this.runner_.Settings.MaxChanges)
			return { NeedsConfirm: true, ChangeCount: changes.length };
		const all: IFileEntry[] = [];
		let done = 0;
		for (let idx = 0; idx < changes.length; idx += kBatch)
		{
			_call.Signal.throwIfAborted();
			const slice = changes.slice(idx, idx + kBatch).map((_c) => _c.Change);
			const described = await this.runner_.Describe(slice, _call.Signal);
			for (const info of described)
				all.push(...info.Files);
			done += slice.length;
			_call.Progress(done / Math.max(1, changes.length), `describe ${done}/${changes.length}`);
		}
		let files = FilterFiles(all, parsed);
		if (parsed.Dedupe)
			files = DedupeFiles(files);
		const lines = files.map((_f) => `#${_f.Rev} ${_f.Change} ${_f.DepotPath}`);
		if (output === "Clipboard" && this.copyText_ !== null)
			this.copyText_(lines.join("\n"));
		if (output === "File" && this.emitFile_ !== null)
		{
			const filePath = await this.emitFile_(`extract-${Date.now()}.txt`, lines.join("\n"));
			return { Count: files.length, ChangeCount: changes.length, FilePath: filePath, Files: files.slice(0, kPreview) };
		}
		return { Count: files.length, ChangeCount: changes.length, Files: files };
	}
}
