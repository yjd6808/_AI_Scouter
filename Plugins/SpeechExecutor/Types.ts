/*
	작성자: Scouter
	생성일: 2026-09-24
	=====
	설명: SpeechExecutor 공용 타입 + 트리거 매칭 순수 함수.
*/

export type Role = "idle" | "listening" | "connected";

export interface ITriggerMapping
{
	Text: string;
	Func: string;
}

export interface IKeyEntry
{
	Id: string;
	Name: string;
	Provider: string;
	ApiKey: string;
}

export type PeerMessage =
	| { type: "final"; text: string }
	| { type: "ping"; ts: number }
	| { type: "hello"; nick?: string }
	| { type: "error"; msg?: string };

export const kHeartbeatMs = 30000;
export const kFunctionFile = "SpeechFunctions.js";
export const kWatchMs = 500;

//////////////////////////////////////////////////////////////////////////////////////
// 공백·문장부호 제거 + 소문자화 (한글은 불변).
// @param _s: 원문
export function Normalize(_s: string): string
{
	let out = "";
	const lower = _s.toLowerCase();
	for (let idx = 0; idx < lower.length; idx++)
	{
		const ch = lower[idx] ?? "";
		if (/\s/.test(ch))
			continue;
		if (/[\p{P}\p{S}]/u.test(ch))
			continue;
		out += ch;
	}
	return out;
}

//////////////////////////////////////////////////////////////////////////////////////
// Levenshtein 유사도 0..1.
// @param _a: 비교문
// @param _b: 비교문
export function Similarity(_a: string, _b: string): number
{
	const a = Normalize(_a);
	const b = Normalize(_b);
	if (a === b)
		return 1;
	if (a.length === 0 || b.length === 0)
		return 0;
	const ah = a.split("");
	const bh = b.split("");
	const d: number[][] = [];
	for (let idx = 0; idx <= ah.length; idx++)
	{
		const row: number[] = [];
		for (let jdx = 0; jdx <= bh.length; jdx++)
			row.push(0);
		d.push(row);
	}
	const cell = (_r: number, _c: number): number =>
	{
		const row = d[_r];
		if (row === undefined)
			return 0;
		return row[_c] ?? 0;
	};
	for (let idx = 0; idx <= ah.length; idx++)
	{
		const row = d[idx];
		if (row === undefined)
			continue;
		row[0] = idx;
	}
	const first = d[0];
	if (first !== undefined)
	{
		for (let jdx = 0; jdx <= bh.length; jdx++)
			first[jdx] = jdx;
	}
	for (let idx = 1; idx <= ah.length; idx++)
	{
		for (let jdx = 1; jdx <= bh.length; jdx++)
		{
			const ca = ah[idx - 1] ?? "";
			const cb = bh[jdx - 1] ?? "";
			const cost = ca === cb ? 0 : 1;
			const row = d[idx];
			if (row === undefined)
				continue;
			row[jdx] = Math.min(cell(idx - 1, jdx) + 1, cell(idx, jdx - 1) + 1, cell(idx - 1, jdx - 1) + cost);
		}
	}
	return 1 - cell(ah.length, bh.length) / Math.max(ah.length, bh.length);
}

//////////////////////////////////////////////////////////////////////////////////////
// 발화가 트리거 필드와 매칭되는가. ';'로 여러 개 지정, 공백 무시.
// @param _utterance: 발화
// @param _field: 트리거 필드
export function IsTrigger(_utterance: string, _field: string): boolean
{
	if (_field.trim().length === 0)
		return false;
	const parts = _field.split(";");
	for (let idx = 0; idx < parts.length; idx++)
	{
		const raw = parts[idx] ?? "";
		const trigger = raw.trim();
		if (trigger.length === 0)
			continue;
		const nu = Normalize(_utterance);
		const nt = Normalize(trigger);
		if (nu === nt || nu.endsWith(nt))
			return true;
		if (Similarity(_utterance, trigger) >= 0.8)
			return true;
	}
	return false;
}

//////////////////////////////////////////////////////////////////////////////////////
// "host:port" 파싱.
// @param _text: 입력
export function ParseHostPort(_text: string): { Host: string; Port: number } | null
{
	const m = _text.trim().match(/^(.*?):(\d{1,5})$/);
	if (m === null)
		return null;
	const host = m[1] ?? "";
	const port = Number(m[2] ?? "");
	if (host.length === 0 || Number.isNaN(port) || port < 1 || port > 65535)
		return null;
	return { Host: host, Port: port };
}
