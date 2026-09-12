/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: LayoutLint. XmlLoader dry-run + W041/W060 정적 검사.
*/

import { XmlLoader } from "./XmlLoader";
import { LoadContext } from "./LoadContext";
import type { ILintMessage } from "./LoadContext";
import { DataList } from "./DataList";
import type { Window } from "../Host/Window";

const kInteractiveTags = new Set(["Button", "TextBox", "ComboBox", "ListBox", "CheckBox", "RadioButton", "Slider", "PasswordBox", "NumericUpDown"]);

export class LayoutLint
{
	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// XML 1개를 검사한다. 에러·경고 전부를 반환.
	// @param _xml: XML 원문
	// @param _ctx: 로드 문맥 (Handlers·Settings 스텁 가능)
	public static LintXml(_xml: string, _ctx: LoadContext): ILintMessage[]
	{
		const host = new LintHost();
		const result = XmlLoader.LoadWindowInto(host as unknown as Window, _xml, _ctx);
		const out = [...result.Errors, ...result.Warnings];
		out.push(...LayoutLint.StaticChecks(_xml));
		XmlLoader.UnsubscribeAll(host as unknown as Window);
		host.Dispose();
		return out;
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 로더가 못 보는 정적 검사. W041/W060.
	// @param _xml: 원문
	private static StaticChecks(_xml: string): ILintMessage[]
	{
		const out: ILintMessage[] = [];
		let doc: Document;
		try
		{
			doc = new DOMParser().parseFromString(XmlLoader.TranslateAttached(_xml), "application/xml");
		}
		catch
		{
			return out;
		}
		if (doc.getElementsByTagName("parsererror").length > 0)
			return out;
		const all = doc.getElementsByTagName("*");
		for (const el of Array.from(all))
		{
			const tag = el.tagName.includes(":") ? (el.tagName.split(":")[1] as string) : el.tagName;
			if (kInteractiveTags.has(tag) && (el.getAttribute("Name") ?? "").length === 0)
				out.push({ Code: "W041", Line: 0, Column: 0, Text: `상호작용 컨트롤에 Name 없음: ${tag}` });
			for (const attr of Array.from(el.attributes))
			{
				if (attr.value.includes("{"))
					continue;
				if (/#[0-9a-fA-F]{3,8}\b/.test(attr.value) || attr.value.includes("rgb("))
					out.push({ Code: "W060", Line: 0, Column: 0, Text: `리터럴 색: ${attr.name}=${attr.value}` });
			}
		}
		return out;
	}
}

class LintHost
{
	// ==================== 멤버 ====================
	public readonly DataList = new DataList();

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// dry-run용 껍데기. AddChild·Dispose만 흉내.
	public AddChild(_child: unknown): void
	{
		// dry-run 껍데기. 자식을 버린다.
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// dry-run용 껍데기.
	public Dispose(): void
	{
	}
}
