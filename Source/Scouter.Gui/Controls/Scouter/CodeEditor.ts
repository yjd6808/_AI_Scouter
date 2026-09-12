/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: CodeEditor. monaco 지연 로드 에디터.
*/

import type * as Monaco from "monaco-editor";
import { UIProperty } from "../../Core/UIProperty";
import { RoutedEvent, RoutedEventArgs, RoutingStrategy } from "../../Core/RoutedEvent";
import { Control } from "../Control";
import { RegisterElement } from "../RegisterElement";
import { MonacoLoader } from "./MonacoLoader";

export interface IEditorMarker
{
	Line: number;
	Message: string;
	Severity: "error" | "warning" | "info";
}

@RegisterElement("CodeEditor")
export class CodeEditor extends Control
{
	// ==================== 정적 ====================
	public static readonly LanguageProperty = UIProperty.Register<string>("Language", CodeEditor, { Default: "plaintext" });
	public static readonly TextProperty = UIProperty.Register<string>("Text", CodeEditor, { Default: "" });
	public static readonly ReadOnlyProperty = UIProperty.Register<boolean>("ReadOnly", CodeEditor, { Default: false });
	public static readonly LineNumbersProperty = UIProperty.Register<boolean>("LineNumbers", CodeEditor, { Default: true });
	public static readonly MinimapProperty = UIProperty.Register<boolean>("Minimap", CodeEditor, { Default: false });
	public static readonly WordWrapProperty = UIProperty.Register<boolean>("WordWrap", CodeEditor, { Default: false });

	// ==================== 멤버 ====================
	protected editor_: Monaco.editor.IStandaloneCodeEditor | null = null;
	private loading_ = false;
	private pendingText_: string | null = null;

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 에디터를 만든다. monaco는 부착 후 지연 로드.
	public constructor()
	{
		super();
		this.Element.classList.add("gui-codeeditor");
		this.Loaded.Add(() =>
		{
			void this.EnsureAsync();
		});
		this.SizeChanged.Add(() =>
		{
			this.editor_?.layout();
		});
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 에디터를 걷어낸다.
	public override Dispose(): void
	{
		this.editor_?.dispose();
		this.editor_ = null;
		super.Dispose();
	}

	// ==================== 속성 ====================
	public get Language(): string { return this.GetValue(CodeEditor.LanguageProperty); }
	public set Language(_v: string) { this.SetValue(CodeEditor.LanguageProperty, _v); }
	public get Text(): string { return this.GetValue(CodeEditor.TextProperty); }

	//////////////////////////////////////////////////////////////////////////////////////
	// 텍스트를 바꾼다. 로드 전이면 대기시켰다 적용.
	// @param _v: 원문
	public set Text(_v: string)
	{
		this.SetValue(CodeEditor.TextProperty, _v);
		if (this.editor_ !== null)
			this.editor_.setValue(_v);
		else
			this.pendingText_ = _v;
	}
	public get ReadOnly(): boolean { return this.GetValue(CodeEditor.ReadOnlyProperty); }

	//////////////////////////////////////////////////////////////////////////////////////
	// 읽기 전용을 바꾼다.
	// @param _v: 여부
	public set ReadOnly(_v: boolean) { this.SetValue(CodeEditor.ReadOnlyProperty, _v); }

	// ==================== 이벤트 ====================
	public readonly TextChanged = new RoutedEvent<RoutedEventArgs>("TextChanged", RoutingStrategy.Bubble);

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 지정 줄을 보이게 한다.
	// @param _line: 1-based 줄
	public RevealLine(_line: number): void
	{
		this.editor_?.revealLine(Math.max(1, _line));
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 마커를 찍는다.
	// @param _markers: 마커들
	public SetMarkers(_markers: IEditorMarker[]): void
	{
		const editor = this.editor_;
		if (editor === null)
			return;
		const model = editor.getModel();
		if (model === null)
			return;
		void MonacoLoader.LoadAsync().then((_m) =>
		{
			const severityOf = (_s: IEditorMarker["Severity"]): number =>
			{
				if (_s === "error")
					return _m.MarkerSeverity.Error;
				if (_s === "warning")
					return _m.MarkerSeverity.Warning;
				return _m.MarkerSeverity.Info;
			};
			_m.editor.setModelMarkers(model, "scouter", _markers.map((_k) => ({
				startLineNumber: _k.Line, startColumn: 1, endLineNumber: _k.Line, endColumn: 1000,
				message: _k.Message, severity: severityOf(_k.Severity),
			})));
		});
	}

	// ==================== 확장점 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// monaco 에디터를 만든다. DiffView가 갈아낀다.
	// @param _monaco: 로드된 monaco
	protected CreateEditor(_monaco: typeof Monaco): void
	{
		this.editor_ = _monaco.editor.create(this.Element, {
			value: this.pendingText_ ?? this.Text,
			language: this.Language,
			readOnly: this.ReadOnly,
			automaticLayout: false,
			minimap: { enabled: false },
			lineNumbers: "on",
			wordWrap: "off",
			fontFamily: "var(--gui-font-mono)",
			theme: "scouter",
		});
		this.pendingText_ = null;
		this.editor_.onDidChangeModelContent(() =>
		{
			if (this.editor_ === null)
				return;
			this.SetValue(CodeEditor.TextProperty, this.editor_.getValue());
			this.RaiseEvent(this.TextChanged, new RoutedEventArgs(this));
		});
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 부착됐을 때 monaco를 로드한다. 미부착이면 건너뛴다.
	private async EnsureAsync(): Promise<void>
	{
		if (this.editor_ !== null || this.loading_ || !this.Element.isConnected)
			return;
		this.loading_ = true;
		try
		{
			// 로드 중 창이 닫히면 detached 호스트에 만들어진다. Dispose가 정리.
			const monaco = await MonacoLoader.LoadAsync();
			this.CreateEditor(monaco);
		}
		finally
		{
			this.loading_ = false;
		}
	}
}
