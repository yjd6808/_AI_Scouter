/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: PropertyGrid. JSON Schema → 에디터 행. 검증은 소유자 콜백.
*/

import { UIElement } from "../../Core/UIElement";
import { SimpleEvent } from "../../Core/SimpleEvent";
import { Control } from "../Control";
import { RegisterElement } from "../RegisterElement";
import { TextBlock } from "../TextBlock";
import { TextBox } from "../TextBox";
import { PasswordBox } from "../PasswordBox";
import { CheckBox } from "../CheckBox";
import { ComboBox } from "../Items/ComboBox";
import { NumericUpDown } from "../Range";
import { Expander } from "../Items/Expander";
import { UIValues } from "../../Xml/UIValue";

export interface IJsonSchemaNode
{
	type?: string;
	enum?: unknown[];
	minimum?: number;
	maximum?: number;
	description?: string;
	default?: unknown;
	properties?: Record<string, IJsonSchemaNode>;
	items?: IJsonSchemaNode;
	// eslint-disable-next-line @typescript-eslint/naming-convention -- JSON Schema x- 확장 스펙 그대로
	"x-category"?: string;
	// eslint-disable-next-line @typescript-eslint/naming-convention -- JSON Schema x- 확장 스펙 그대로
	"x-order"?: number;
	// eslint-disable-next-line @typescript-eslint/naming-convention -- JSON Schema x- 확장 스펙 그대로
	"x-secret"?: boolean;
	// eslint-disable-next-line @typescript-eslint/naming-convention -- JSON Schema x- 확장 스펙 그대로
	"x-editor"?: string;
}

export interface IPropertyEditor
{
	Element: UIElement;
	Get(): unknown;
	Set(_v: unknown): void;
	Changed: SimpleEvent<void>;
}

class TextEditor implements IPropertyEditor
{
	// ==================== 멤버 ====================
	private readonly box_: TextBox;
	private readonly changed_ = new SimpleEvent<void>();

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 텍스트 에디터를 만든다.
	// @param _multiline: 여러 줄 여부(P4 TextBox 단일행만)
	public constructor(_multiline: boolean)
	{
		this.box_ = new TextBox();
		this.box_.TextCommitted.Add(() =>
		{
			this.changed_.Invoke(undefined);
		});
	}

	// ==================== 속성 ====================
	public get Element(): UIElement { return this.box_; }
	public get Changed(): SimpleEvent<void> { return this.changed_; }

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 값을 읽는다.
	public Get(): unknown
	{
		return this.box_.Text;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 값을 쓴다.
	// @param _v: 값
	public Set(_v: unknown): void
	{
		this.box_.Text = UIValues.ToText(_v);
	}
}

class CheckEditor implements IPropertyEditor
{
	// ==================== 멤버 ====================
	private readonly box_: CheckBox;
	private readonly changed_ = new SimpleEvent<void>();

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 체크 에디터를 만든다.
	public constructor()
	{
		this.box_ = new CheckBox();
		this.box_.Click.Add(() =>
		{
			this.changed_.Invoke(undefined);
		});
	}

	// ==================== 속성 ====================
	public get Element(): UIElement { return this.box_; }
	public get Changed(): SimpleEvent<void> { return this.changed_; }

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 값을 읽는다.
	public Get(): unknown
	{
		return this.box_.IsChecked;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 값을 쓴다.
	// @param _v: 값
	public Set(_v: unknown): void
	{
		this.box_.IsChecked = _v === true;
	}
}

class NumberEditor implements IPropertyEditor
{
	// ==================== 멤버 ====================
	private readonly num_: NumericUpDown;
	private readonly changed_ = new SimpleEvent<void>();

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 숫자 에디터를 만든다.
	// @param _min: 최소
	// @param _max: 최대
	public constructor(_min: number, _max: number)
	{
		this.num_ = new NumericUpDown();
		this.num_.Minimum = _min;
		this.num_.Maximum = _max;
		this.num_.ValueChanged.Add(() =>
		{
			this.changed_.Invoke(undefined);
		});
	}

	// ==================== 속성 ====================
	public get Element(): UIElement { return this.num_; }
	public get Changed(): SimpleEvent<void> { return this.changed_; }

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 값을 읽는다.
	public Get(): unknown
	{
		return this.num_.Value;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 값을 쓴다.
	// @param _v: 값
	public Set(_v: unknown): void
	{
		this.num_.Value = Number(_v);
	}
}

class EnumEditor implements IPropertyEditor
{
	// ==================== 멤버 ====================
	private readonly combo_: ComboBox;
	private readonly changed_ = new SimpleEvent<void>();

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 열거 에디터를 만든다.
	// @param _options: 후보값
	public constructor(_options: unknown[])
	{
		this.combo_ = new ComboBox();
		this.combo_.SetItems(_options.map((_o) => String(_o)));
		this.combo_.SelectionChanged.Add(() =>
		{
			this.changed_.Invoke(undefined);
		});
	}

	// ==================== 속성 ====================
	public get Element(): UIElement { return this.combo_; }
	public get Changed(): SimpleEvent<void> { return this.changed_; }

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 값을 읽는다.
	public Get(): unknown
	{
		return this.combo_.SelectedItem;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 값을 쓴다.
	// @param _v: 값
	public Set(_v: unknown): void
	{
		this.combo_.SelectedItem = String(_v);
	}
}

class SecretEditor implements IPropertyEditor
{
	// ==================== 멤버 ====================
	private readonly box_: PasswordBox;
	private readonly changed_ = new SimpleEvent<void>();

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 시크릿 에디터를 만든다.
	public constructor()
	{
		this.box_ = new PasswordBox();
		this.box_.PasswordChanged.Add(() =>
		{
			this.changed_.Invoke(undefined);
		});
	}

	// ==================== 속성 ====================
	public get Element(): UIElement { return this.box_; }
	public get Changed(): SimpleEvent<void> { return this.changed_; }

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 값을 읽는다.
	public Get(): unknown
	{
		return this.box_.Password;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 값을 쓴다.
	// @param _v: 값
	public Set(_v: unknown): void
	{
		this.box_.Password = UIValues.ToText(_v);
	}
}

export class EditorFactory
{
	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 스키마 노드에 맞는 에디터를 만든다.
	// @param _schema: 스키마 노드
	public static Create(_schema: IJsonSchemaNode): IPropertyEditor
	{
		if (_schema["x-secret"] === true)
			return new SecretEditor();
		if (_schema.enum !== undefined)
			return new EnumEditor(_schema.enum);
		if (_schema.type === "boolean")
			return new CheckEditor();
		if (_schema.type === "integer" || _schema.type === "number")
			return new NumberEditor(_schema.minimum ?? 0, _schema.maximum ?? 100);
		return new TextEditor(_schema["x-editor"] === "multiline");
	}
}

@RegisterElement("PropertyGrid")
export class PropertyGrid extends Control
{
	// ==================== 멤버 ====================
	private schema_: IJsonSchemaNode | null = null;
	private value_: Record<string, unknown> = {};
	private readonly editors_ = new Map<string, IPropertyEditor>();
	private validate_: ((_path: string, _value: unknown) => string | null) | null = null;

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 그리드를 만든다.
	public constructor()
	{
		super();
		this.Element.classList.add("gui-propertygrid");
	}

	// ==================== 이벤트 ====================
	public readonly ValueChanged = new SimpleEvent<{ Path: string; Value: unknown }>();

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 검증 콜백을 둔다. null 반환이면 유효.
	// @param _validate: 검증기
	public SetValidator(_validate: (_path: string, _value: unknown) => string | null): void
	{
		this.validate_ = _validate;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 스키마·값을 깔고 행을 만든다.
	// @param _schema: 스키마
	// @param _value: 값
	public SetSchema(_schema: IJsonSchemaNode, _value: Record<string, unknown>): void
	{
		this.schema_ = _schema;
		this.value_ = { ..._value };
		this.editors_.clear();
		this.ClearChildren();
		const props = _schema.properties ?? {};
		const groups = new Map<string, Array<[string, IJsonSchemaNode]>>();
		for (const [key, node] of Object.entries(props))
		{
			const category = node["x-category"] ?? "일반";
			let list = groups.get(category);
			if (list === undefined)
			{
				list = [];
				groups.set(category, list);
			}
			list.push([key, node]);
		}
		for (const [category, list] of groups)
		{
			const expander = new Expander();
			expander.Header = category;
			for (const [key, node] of list.sort((_a, _b) => (_a[1]["x-order"] ?? 0) - (_b[1]["x-order"] ?? 0)))
				this.AddRow(expander, key, node);
			this.AddChild(expander);
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 현재 값을 묶어 반환한다.
	public Get(): Record<string, unknown>
	{
		return { ...this.value_ };
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 행 1개를 만든다. 라벨+에디터+에러줄.
	// @param _parent: 부모 Expander
	// @param _key: 키
	// @param _node: 스키마 노드
	private AddRow(_parent: Expander, _key: string, _node: IJsonSchemaNode): void
	{
		const label = new TextBlock();
		label.Text = _key;
		if (_node.description !== undefined)
			label.ToolTip = _node.description;
		const editor = EditorFactory.Create(_node);
		editor.Set(this.value_[_key] ?? _node.default);
		const error = new TextBlock();
		error.Element.classList.add("gui-propertygrid__error");
		_parent.AddChild(label);
		_parent.AddChild(editor.Element);
		_parent.AddChild(error);
		this.editors_.set(_key, editor);
		editor.Changed.Add(() =>
		{
			const next = editor.Get();
			if (this.validate_ !== null)
			{
				const message = this.validate_(_key, next);
				error.Text = message ?? "";
				if (message !== null)
					return;
			}
			this.value_[_key] = next;
			this.ValueChanged.Invoke({ Path: _key, Value: next });
		});
	}
}
