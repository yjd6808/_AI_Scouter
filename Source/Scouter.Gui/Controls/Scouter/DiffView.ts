/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: DiffView. monaco diff 에디터.
*/

import type * as Monaco from "monaco-editor";
import { UIProperty } from "../../Core/UIProperty";
import { RegisterElement } from "../RegisterElement";
import { CodeEditor } from "./CodeEditor";

@RegisterElement("DiffView")
export class DiffView extends CodeEditor
{
	// ==================== 정적 ====================
	public static readonly OriginalProperty = UIProperty.Register<string>("Original", DiffView, { Default: "" });
	public static readonly ModifiedProperty = UIProperty.Register<string>("Modified", DiffView, { Default: "" });
	public static readonly SideBySideProperty = UIProperty.Register<boolean>("SideBySide", DiffView, { Default: true });

	// ==================== 멤버 ====================
	private diff_: Monaco.editor.IStandaloneDiffEditor | null = null;

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// diff 뷰를 만든다.
	public constructor()
	{
		super();
		this.Element.classList.add("gui-diffview");
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// diff 에디터를 걷어낸다.
	public override Dispose(): void
	{
		this.diff_?.dispose();
		this.diff_ = null;
		super.Dispose();
	}

	// ==================== 속성 ====================
	public get Original(): string { return this.GetValue(DiffView.OriginalProperty); }
	public set Original(_v: string) { this.SetValue(DiffView.OriginalProperty, _v); }
	public get Modified(): string { return this.GetValue(DiffView.ModifiedProperty); }
	public set Modified(_v: string) { this.SetValue(DiffView.ModifiedProperty, _v); }
	public get SideBySide(): boolean { return this.GetValue(DiffView.SideBySideProperty); }
	public set SideBySide(_v: boolean) { this.SetValue(DiffView.SideBySideProperty, _v); }

	// ==================== 확장점 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// diff 에디터를 만든다.
	// @param _monaco: 로드된 monaco
	protected override CreateEditor(_monaco: typeof Monaco): void
	{
		const diff = _monaco.editor.createDiffEditor(this.Element, {
			readOnly: this.ReadOnly,
			renderSideBySide: this.SideBySide,
			fontFamily: "var(--gui-font-mono)",
			theme: "scouter",
		});
		const original = _monaco.editor.createModel(this.Original, this.Language);
		const modified = _monaco.editor.createModel(this.Modified, this.Language);
		diff.setModel({ original: original, modified: modified });
		this.diff_ = diff;
	}
}
