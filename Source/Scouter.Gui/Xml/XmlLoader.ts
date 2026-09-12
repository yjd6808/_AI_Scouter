/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: XmlLoader 2-pass. 생성 → 바인딩. DOMParser만 쓴다.
*/

import { UIElement } from "../Core/UIElement";
import { UIProperty } from "../Core/UIProperty";
import { UIValues } from "./UIValue";
import type { UIValue } from "./UIValue";
import { DataList } from "./DataList";
import { ElementCatalog } from "./ElementCatalog";
import { AttributeApplier } from "./AttributeApplier";
import { Binding } from "./Binding";
import { BindingGraph } from "./BindingGraph";
import type { IBindingScope } from "./BindingResolver";
import type { LoadContext, ILintMessage } from "./LoadContext";
import { ContentControl } from "../Controls/ContentControl";
import { Grid } from "../Panels/Grid";
import { GridLength, RowDefinition, ColumnDefinition } from "../Panels/GridDefinitions";
import type { Window } from "../Host/Window";
import type { UserControl } from "../Host/UserControl";
import type { IDisposable } from "../Core/Disposable";

export interface ILoadResult
{
	Ok: boolean;
	Errors: ILintMessage[];
	Warnings: ILintMessage[];
}

const kSubscriptions = new Map<UIElement, IDisposable[]>();

export class XmlLoader
{
	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 붙임 속성 점을 대시로 치환한다. happy-dom 파서가 점을 거부하므로(크롬 정상). 동일 길이 유지.
	// @param _xml: 원문
	public static TranslateAttached(_xml: string): string
	{
		return _xml.replace(/(\s)([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z_][A-Za-z0-9_]*)(\s*=)/g, "$1$2-$3$4");
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 창에 XML을 읽힌다. 오류면 false, 성공해도 경고는 Warnings에.
	// @param _host: 창
	// @param _xml: XML 원문
	// @param _ctx: 로드 문맥
	public static LoadWindowInto(_host: Window | UserControl, _xml: string, _ctx: LoadContext): ILoadResult
	{
		const errors: ILintMessage[] = [];
		XmlLoader.UnsubscribeAll(_host);
		_ctx.Owner = _host;
		_ctx.Names.clear();
		_ctx.Pending.length = 0;
		let doc: Document;
		try
		{
			doc = XmlLoader.Parse(_xml);
		}
		catch (_e)
		{
			errors.push({ Code: "E000", Line: 0, Column: 0, Text: String(_e) });
			return { Ok: false, Errors: errors, Warnings: _ctx.Warnings };
		}
		const root = doc.documentElement;
		if (root.tagName !== "Window" && root.tagName !== "UserControl")
		{
			errors.push({ Code: "E001", Line: 0, Column: 0, Text: `루트는 Window/UserControl: ${root.tagName}` });
			return { Ok: false, Errors: errors, Warnings: _ctx.Warnings };
		}
		try
		{
			XmlLoader.ApplyDataList(_host, root, _ctx, errors);
			const content = XmlLoader.FindContentHost(root, errors);
			if (content === null)
				return { Ok: false, Errors: errors, Warnings: _ctx.Warnings };
			const built = XmlLoader.BuildTree(content, _host, _ctx, errors);
			_host.AddChild(built);
			XmlLoader.ResolvePending(_host, _ctx, errors);
		}
		catch (_e)
		{
			const msg = _e instanceof Error ? _e.message : String(_e);
			const code = /(E\d{3})/.exec(msg)?.[1] ?? "E000";
			errors.push({ Code: code, Line: 0, Column: 0, Text: msg });
			return { Ok: false, Errors: errors, Warnings: _ctx.Warnings };
		}
		return { Ok: errors.length === 0, Errors: errors, Warnings: _ctx.Warnings };
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 조각 XML을 요소로 만든다. 하네스 갤러리용.
	// @param _xml: XML 원문
	// @param _ctx: 로드 문맥
	// @param _owner: 소유 창
	public static LoadFragment(_xml: string, _ctx: LoadContext, _owner: Window | UserControl): UIElement | null
	{
		let doc: Document;
		try
		{
			doc = XmlLoader.Parse(_xml);
		}
		catch
		{
			return null;
		}
		const errors: ILintMessage[] = [];
		let built: UIElement;
		try
		{
			built = XmlLoader.BuildTree(doc.documentElement, _owner, _ctx, errors);
		}
		catch
		{
			return null;
		}
		if (errors.length > 0)
			return null;
		XmlLoader.ResolvePending(_owner, _ctx, errors);
		return errors.length > 0 ? null : built;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 소유자의 구독을 전부 푼다. Reload·Dispose용.
	// @param _owner: 소유 창
	public static UnsubscribeAll(_owner: UIElement): void
	{
		const subs = kSubscriptions.get(_owner);
		if (subs === undefined)
			return;
		for (const sub of subs)
			sub.Dispose();
		kSubscriptions.delete(_owner);
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// XML을 파싱한다. parsererror면 throw.
	// @param _xml: 원문
	private static Parse(_xml: string): Document
	{
		const doc = new DOMParser().parseFromString(XmlLoader.TranslateAttached(_xml), "application/xml");
		const found = Array.from(doc.getElementsByTagName("parsererror"));
		const firstError = found.at(0);
		if (firstError !== undefined)
			throw new Error(`XML 파싱 실패: ${firstError.textContent}`);
		return doc;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// DataList를 선언한다. E020/E021은 errors에.
	// @param _host: 창
	// @param _root: 루트 노드
	// @param _ctx: 문맥
	// @param _errors: 오류 수집
	private static ApplyDataList(_host: Window | UserControl, _root: Element, _ctx: LoadContext, _errors: ILintMessage[]): void
	{
		const data = _host.DataList;
		data.Reset();
		_ctx.Data = data;
		for (const child of XmlLoader.ElementsOf(_root))
		{
			if (child.tagName !== "DataList" && !child.tagName.endsWith(".Data"))
				continue;
			for (const item of XmlLoader.ElementsOf(child))
			{
				if (item.tagName !== "Data" && item.tagName !== "Item")
					continue;
				const key = item.getAttribute("Key") ?? "";
				const typeText = item.getAttribute("Type") ?? "";
				const value = item.getAttribute("Value") ?? "";
				const type = DataList.NormalizeType(typeText);
				if (type === null)
				{
					_errors.push({ Code: "E020", Line: XmlLoader.LineOf(item), Column: 0, Text: `알 수 없는 Type: ${typeText}` });
					continue;
				}
				try
				{
					data.Declare(key, type, value);
				}
				catch
				{
					_errors.push({ Code: "E021", Line: XmlLoader.LineOf(item), Column: 0, Text: `Value 변환 불가: ${key}` });
				}
			}
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 내용 호스트 1개를 찾는다. DataList 외 자식이 1개면 암시.
	// @param _root: 루트 노드
	// @param _errors: 오류 수집
	private static FindContentHost(_root: Element, _errors: ILintMessage[]): Element | null
	{
		const kids = XmlLoader.ElementsOf(_root).filter((_inner) => _inner.tagName !== "DataList" && !_inner.tagName.endsWith(".Data"));
		const explicit = kids.filter((_inner) => _inner.getAttribute("ContentHost") === "true");
		const onlyExplicit = explicit.at(0);
		if (explicit.length === 1 && onlyExplicit !== undefined)
			return onlyExplicit;
		if (explicit.length > 1)
		{
			_errors.push({ Code: "E002", Line: 0, Column: 0, Text: "ContentHost 2개 이상" });
			return null;
		}
		if (kids.length === 1)
		{
			const only = kids.at(0);
			if (only !== undefined)
				return only;
		}
		_errors.push({ Code: "E002", Line: 0, Column: 0, Text: "ContentHost 0개" });
		return null;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 트리를 깊이 우선으로 만든다. Pass 1.
	// @param _node: XML 노드
	// @param _owner: 소유 창
	// @param _ctx: 문맥
	// @param _errors: 오류 수집
	private static BuildTree(_node: Element, _owner: Window | UserControl, _ctx: LoadContext, _errors: ILintMessage[]): UIElement
	{
		if (_node.tagName.includes("."))
		{
			throw new Error(`E011 속성 요소는 부모에서 처리: ${_node.tagName}`);
		}
		const el = ElementCatalog.Create(_node.tagName);
		if (el === null)
			throw new Error(`E010 미등록 태그: ${_node.tagName}`);
		for (const attr of Array.from(_node.attributes))
		{
			if (attr.name === "xmlns" || attr.name.startsWith("xmlns:"))
				continue;
			if (attr.name === "ContentHost")
				continue;
			try
			{
				AttributeApplier.Apply(el, attr.name, attr.value, _ctx);
			}
			catch (_e)
			{
				const msg = _e instanceof Error ? _e.message : String(_e);
				throw new Error(`${msg} (#${XmlLoader.LineOf(_node)})`);
			}
		}
		const name = _node.getAttribute("Name") ?? "";
		if (name.length > 0)
		{
			if (_ctx.Names.has(name))
				throw new Error(`E030 Name 중복: ${name}`);
			_ctx.Names.set(name, el);
			if (!/^[a-z][a-z0-9_]*$/.test(name))
				_ctx.Warnings.push({ Code: "W040", Line: XmlLoader.LineOf(_node), Column: 0, Text: `snake_case 아님: ${name}` });
		}
		for (const child of XmlLoader.ElementsOf(_node))
		{
			if (child.tagName.startsWith(`${_node.tagName}.`))
			{
				XmlLoader.ApplyPropertyElement(el, child, _ctx);
				continue;
			}
			const built = XmlLoader.BuildTree(child, _owner, _ctx, _errors);
			try
			{
				el.AddChild(built);
			}
			catch
			{
				throw new Error(`E003 자식 추가 실패: ${_node.tagName}`);
			}
		}
		XmlLoader.ApplyText(el, _node);
		return el;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 속성 요소(<Grid.RowDefinitions>텍스트형)를 적용한다.
	// @param _el: 요소
	// @param _node: 속성 노드
	// @param _ctx: 문맥
	// @param _errors: 오류 수집
	private static ApplyPropertyElement(_el: UIElement, _node: Element, _ctx: LoadContext): void
	{
		const dot = _node.tagName.indexOf(".");
		const propName = _node.tagName.slice(dot + 1);
		if ((_el instanceof Grid) && (propName === "RowDefinitions" || propName === "ColumnDefinitions"))
		{
			XmlLoader.ApplyGridDefinitions(_el, propName, _node);
			return;
		}
		const prop = UIProperty.Lookup(_el.constructor, propName);
		if (prop === null)
			throw new Error(`E011 미등록 속성: ${_node.tagName}`);
		const text = _node.textContent.trim();
		AttributeApplier.Apply(_el, propName, text.length > 0 ? text : (_node.getAttribute("Value") ?? ""), _ctx);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// Grid 정의 자식을 읽는다. <RowDefinition Height> / <ColumnDefinition Width>.
	// @param _grid: Grid
	// @param _prop: RowDefinitions/ColumnDefinitions
	// @param _node: 속성 노드
	private static ApplyGridDefinitions(_grid: Grid, _prop: string, _node: Element): void
	{
		const num = (_el: Element, _attr: string, _def: number): number =>
		{
			const raw = _el.getAttribute(_attr);
			if (raw === null || raw.length === 0)
				return _def;
			const parsed = Number(raw);
			if (Number.isNaN(parsed))
				throw new Error(`E021 숫자 아님: ${_attr}=${raw}`);
			return parsed;
		};
		for (const child of XmlLoader.ElementsOf(_node))
		{
			if (child.tagName === "RowDefinition")
			{
				const def = new RowDefinition(GridLength.Parse(child.getAttribute("Height") ?? "*"));
				def.MinHeight = num(child, "MinHeight", 0);
				const maxH = child.getAttribute("MaxHeight");
				def.MaxHeight = maxH === null || maxH.length === 0 ? Number.POSITIVE_INFINITY : num(child, "MaxHeight", Number.POSITIVE_INFINITY);
				_grid.RowDefinitions.Add(def);
			}
			else if (child.tagName === "ColumnDefinition")
			{
				const def = new ColumnDefinition(GridLength.Parse(child.getAttribute("Width") ?? "*"));
				def.MinWidth = num(child, "MinWidth", 0);
				const maxW = child.getAttribute("MaxWidth");
				def.MaxWidth = maxW === null || maxW.length === 0 ? Number.POSITIVE_INFINITY : num(child, "MaxWidth", Number.POSITIVE_INFINITY);
				_grid.ColumnDefinitions.Add(def);
			}
			else
			{
				throw new Error(`E011 정의 자식 아님: ${child.tagName}`);
			}
		}
		_grid.InvalidateTemplate();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 텍스트 노드를 Content/Text에 넣는다.
	// @param _el: 요소
	// @param _node: XML 노드
	private static ApplyText(_el: UIElement, _node: Element): void
	{
		let text = "";
		for (const child of Array.from(_node.childNodes))
		{
			if (child.nodeType === 3)
				text += child.textContent ?? "";
		}
		if (text.trim().length === 0)
			return;
		const contentProp = UIProperty.Lookup(_el.constructor, "Content");
		if (contentProp !== null)
		{
			_el.SetValue(contentProp, contentProp.Parse(text.trim()));
			return;
		}
		const textProp = UIProperty.Lookup(_el.constructor, "Text");
		if (textProp !== null)
		{
			_el.SetValue(textProp, textProp.Parse(text.trim()));
			return;
		}
		if (_el instanceof ContentControl)
		{
			_el.Content = text.trim();
			return;
		}
		throw new Error(`E003 텍스트 불가: ${_node.tagName}`);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 대기 바인딩을 평가·등록한다. Pass 2. E022는 건별 수집.
	// @param _owner: 소유 창
	// @param _ctx: 문맥
	// @param _errors: 오류 수집
	private static ResolvePending(_owner: Window | UserControl, _ctx: LoadContext, _errors: ILintMessage[]): void
	{
		if (_ctx.Graph === null)
			_ctx.Graph = new BindingGraph();
		const graph = _ctx.Graph;
		const subs: IDisposable[] = [];
		for (const pending of _ctx.Pending)
		{
			const target = pending.Target;
			const scope = (): IBindingScope => XmlLoader.MakeScope(target, _ctx);
			const binding = new Binding(target, pending.Property, pending.Parsed, scope);
			try
			{
				binding.Evaluate();
			}
			catch
			{
				_errors.push({ Code: "E022", Line: 0, Column: 0, Text: `바인딩 해석 실패: ${pending.Raw}` });
				binding.Dispose();
				continue;
			}
			graph.Add(binding);
		}
		if (_ctx.Data !== null)
		{
			const data = _ctx.Data;
			subs.push(data.Changed.Add((_keys) =>
			{
				for (const key of _keys)
					graph.MarkDirty(`@${key}`);
			}));
		}
		if (_ctx.Settings !== null)
		{
			const settings = _ctx.Settings;
			const paths = new Set<string>();
			for (const key of graph.DepKeys())
			{
				if (key.startsWith("$settings."))
					paths.add(key.slice("$settings.".length));
			}
			for (const path of paths)
			{
				subs.push(settings.Subscribe(path, () =>
				{
					graph.MarkDirty(`$settings.${path}`);
				}));
			}
		}
		for (const [name, el] of _ctx.Names)
		{
			subs.push(el.PropertyChanged.Add((_s, _a) =>
			{
				graph.MarkDirty(`#${name}.${_a.Property.Name}`);
				for (const key of graph.DepKeys())
				{
					if (key.startsWith("$"))
						graph.MarkDirty(key);
				}
			}));
		}
		const prev = kSubscriptions.get(_owner);
		if (prev !== undefined)
		{
			for (const sub of prev)
				sub.Dispose();
		}
		kSubscriptions.set(_owner, subs);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 바인딩 범위를 만든다. 참조 해결 + Trace 기록.
	// @param _target: 대상 요소
	// @param _ctx: 문맥
	private static MakeScope(_target: UIElement, _ctx: LoadContext): IBindingScope
	{
		return {
			DataGet: (_key: string): UIValue =>
			{
				if (_ctx.Data === null || !_ctx.Data.Has(_key))
					throw new Error(`E022 미선언 키: ${_key}`);
				return UIValues.From(_ctx.Data.Get(_key));
			},
			ElementProp: (_name: string, _prop: string): UIValue =>
			{
				const el = _ctx.Names.get(_name);
				if (el === undefined)
					throw new Error(`E022 대상 없음: ${_name}`);
				if (_prop === "ActualWidth" || _prop === "ActualHeight")
				{
					const rect = el.Element.getBoundingClientRect();
					return UIValues.From(_prop === "ActualWidth" ? rect.width : rect.height);
				}
				const prop = UIProperty.Lookup(el.constructor, _prop);
				if (prop === null)
					throw new Error(`E022 미등록 속성: ${_prop}`);
				return UIValues.From(el.GetValue(prop));
			},
			RelativeProp: (_source: string, _path: string[]): UIValue =>
			{
				const el = XmlLoader.ResolveRelative(_target, _source, _path);
				if (el === null)
					throw new Error(`E022 상대 없음: ${_source}`);
				const propName = _path[_path.length - 1] as string;
				const prop = UIProperty.Lookup(el.constructor, propName);
				if (prop === null)
					throw new Error(`E022 미등록 속성: ${propName}`);
				return UIValues.From(el.GetValue(prop));
			},
			SettingsGet: (_path: string): UIValue =>
			{
				if (_ctx.Settings === null)
					return UIValues.Null();
				return UIValues.From(_ctx.Settings.Get(_path));
			},
			ThemeToken: (_token: string): string =>
			{
				if (_ctx.Theme === null)
					return `var(--${_token})`;
				return _ctx.Theme.Token(_token);
			},
			EnvGet: (_key: string): UIValue =>
			{
				return UIValues.From(_ctx.Env.get(_key) ?? "");
			},
			Trace: (): void =>
			{
				// 실제 수집은 Binding이 감싼다. 여기서는 무시.
			},
		};
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 상대 요소를 찾는다.
	// @param _target: 기준
	// @param _source: parent|root|self|prev|next|ancestor
	// @param _path: 경로
	private static ResolveRelative(_target: UIElement, _source: string, _path: string[]): UIElement | null
	{
		if (_source === "self")
			return _target;
		if (_source === "parent")
			return _target.Parent;
		if (_source === "root")
			return _target.Root;
		if (_source === "ancestor")
		{
			const depth = Number(_path[0] ?? 1);
			let node = _target.Parent;
			for (let idx = 1; idx < depth; ++idx)
				node = node?.Parent ?? null;
			return node;
		}
		if (_source === "prev" || _source === "next")
		{
			const parent = _target.Parent;
			if (parent === null)
				return null;
			const idx = parent.Children.indexOf(_target);
			const sibling = parent.Children[_source === "prev" ? idx - 1 : idx + 1];
			return sibling ?? null;
		}
		return null;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 자식 요소 노드만 모은다.
	// @param _el: 부모 노드
	private static ElementsOf(_el: Element): Element[]
	{
		const out: Element[] = [];
		for (const child of Array.from(_el.childNodes))
		{
			if (child.nodeType === 1)
				out.push(child as Element);
		}
		return out;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 줄 번호. xmldom은 lineNumber, 브라우저는 0.
	// @param _el: 노드
	private static LineOf(_el: Element): number
	{
		const loc = (_el as unknown as { lineNumber?: unknown }).lineNumber;
		return typeof loc === "number" ? loc : 0;
	}
}
