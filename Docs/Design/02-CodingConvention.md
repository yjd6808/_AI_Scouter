# 02. 코딩 컨벤션 — sgcl C++ 규칙의 TypeScript 이식

> 구현 Phase **P0**. 코드를 한 줄 쓰기 전에 ESLint가 이 문서를 강제할 수 있어야 한다. sgcl(`.opencode/rules/coding-conventions_cpp.md`, `2026-08-09-sgf-cpp-coding-convention.md`)의 규칙을 TS 어법에 맞게 옮기고(D-08), 강제 가능한 항목은 전부 커스텀 룰로 만든다.

## 2.1 매핑 표

| 항목 | sgcl C++ | Scouter TS | 강제 |
|---|---|---|---|
| 파일 이름 | `UIElement.h/.cpp` | `UIElement.ts` (PascalCase, 1파일 1주요 클래스) | `unicorn/filename-case` 대신 자체 `scouter/file-name` |
| 클래스·인터페이스·열거 | PascalCase, 인터페이스 `I` 접두 | 동일: `class Button`, `interface ITool`, `enum Visibility` | `@typescript-eslint/naming-convention` |
| 메서드·프로퍼티(public/protected) | PascalCase `SetWidth()` | PascalCase. getter/setter `get Width()` | 동일 |
| 멤버 변수 | `width_` | `width_` (private/protected 필드) | 동일(`suffix: ['_']`) |
| 정적 멤버 | `s_instance_` | `s_instance_` / 상수는 `kMaxLines` | 동일 |
| 파라미터 | `_width` | `_width` | 동일(`prefix: ['_']`) |
| 로컬 변수 | camelCase | camelCase. 루프 카운터 `idx`(`i` 금지) | `scouter/no-loop-i` |
| 중괄호 | Allman | Allman (Prettier 사용 안 함) | `brace-style: allman` |
| 들여쓰기 | 탭 | 탭 | `indent: tab` (`@stylistic`) |
| 메서드 구분선 | `////…`(90 − 들여쓰기×4) + 설명 주석 | 동일 | `scouter/function-separator` |
| 파일 헤더 | `/* 작성자 … ===== … */` | 동일(아래 §2.3) | `scouter/file-header` |
| 멤버 그룹 주석 | `// ==================== 정적 ====================` | 동일, 순서 고정 | `scouter/member-groups` |
| 접근 지정자 | 반드시 | `public/protected/private` 명시 | `explicit-member-accessibility` |
| 확장점 | `virtual void OnXxx()` | `protected OnXxx(): void` + `override` 필수 | `noImplicitOverride` |
| 문자열 | 처리 안 함 | 처리 안 함. 보간은 템플릿 리터럴 | — |
| `any` | — | 금지. `unknown` + 좋은 타입 가드 | `no-explicit-any` |
| null | `nullptr` | `null`(undefined는 옵션 필드에만) | `no-undefined-return` 자체 |

## 2.2 파일 구조 템플릿

```ts
/*
	작성자: 윤정도
	생성일: 2026-09-06
	=====
	설명: 모든 UI 요소의 베이스. DOM 엘리먼트 1개를 소유하고 UIProperty·RoutedEvent·논리 트리를 제공한다.
*/

import { Thickness } from "./Thickness";
import { RoutedEvent, RoutingStrategy } from "./RoutedEvent";

export abstract class UIElement
{
	// ==================== 정적 ====================
	public static readonly WidthProperty = UIProperty.Register<number>("Width", UIElement, { Default: NaN, Parse: UIProperty.ParseLength });
	private static s_nextId_ = 1;

	// ==================== 멤버 ====================
	protected readonly element_: HTMLElement;
	private parent_: UIElement | null = null;
	private readonly children_: UIElement[] = [];

	// ==================== 생성 · 소멸 ====================
	protected constructor(_tag = "div")
	{
		this.element_ = document.createElement(_tag);
		this.element_.dataset.id = String(UIElement.s_nextId_++);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// DOM에서 제거하고 자식까지 정리한다. 두 번 호출해도 안전.
	public Dispose(): void
	{
		for (const child of this.children_)
			child.Dispose();
		this.OnDispose();
		this.element_.remove();
	}

	// ==================== 속성 ====================
	public get Element(): HTMLElement { return this.element_; }
	public get Parent(): UIElement | null { return this.parent_; }

	// ==================== 이벤트 ====================
	public readonly Loaded = this.CreateEvent<RoutedEventArgs>("Loaded", RoutingStrategy.Direct);

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 이름으로 자손 요소를 검색한다. 타입이 다르면 null.
	// @param _type: 기대 클래스
	// @param _name: XML Name (= data-testid)
	public FindName<T extends UIElement>(_type: new (...args: never[]) => T, _name: string): T | null
	{
		const found = this.FindByName(_name);
		return found instanceof _type ? found : null;
	}

	// ==================== 확장점 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 하위 클래스가 자원을 해제한다. 기본 구현 없음.
	protected OnDispose(): void
	{
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 깊이 우선 탐색. 최초 일치 1개.
	private FindByName(_name: string): UIElement | null
	{
		for (const child of this.children_)
		{
			if (child.Name === _name)
				return child;
			const deep = child.FindByName(_name);
			if (deep !== null)
				return deep;
		}
		return null;
	}
}
```

그룹 순서(고정): `정적 → 멤버 → 생성 · 소멸 → 속성 → 이벤트 → 공개 메서드 → 확장점 → 내부`. 비어 있는 그룹은 생략. `////` 구분선 길이 = 90 − (들여쓰기 탭 수 × 4). 구분선 바로 아래 `//` 설명 1줄 이상, 파라미터는 `// @param _x: …`. getter/setter 1줄짜리는 구분선 생략 허용.

## 2.3 라이브러리

| 패키지 | 버전 | 용도 | 사용 API |
|---|---|---|---|
| `eslint` | ^9 | flat config(`eslint.config.mjs`) | `defineConfig`, `RuleTester` |
| `typescript-eslint` | ^8 | 타입 기반 룰, `naming-convention` | `tseslint.configs.strictTypeChecked` |
| `@stylistic/eslint-plugin` | ^3 | `indent`, `brace-style`, `quotes`, `semi`(ESLint core에서 제거된 포매터 룰) | `stylistic.configs.customize` |
| `eslint-plugin-import-x` | ^4 | 순환 import, `no-restricted-paths`(Gui→App 금지) | — |
| `Scripts/EslintPlugin` | 자체 | `function-separator`, `file-header`, `no-loop-i`, `member-groups`, `file-name` | ESLint Rule API(`context.sourceCode.getCommentsBefore`) |
| `typescript` | ^5.6 | strict 옵션 전부 | — |

### eslint.config.mjs

```js
import tseslint from "typescript-eslint";
import stylistic from "@stylistic/eslint-plugin";
import scouter from "./Scripts/EslintPlugin/index.mjs";

export default tseslint.config(
	{ ignores: ["**/dist/**", "**/node_modules/**", "**/*.d.ts"] },
	...tseslint.configs.strictTypeChecked,
	{
		languageOptions: { parserOptions: { projectService: true } },
		plugins: { "@stylistic": stylistic, scouter },
		rules:
		{
			"@stylistic/indent": ["error", "tab", { SwitchCase: 1 }],
			"@stylistic/brace-style": ["error", "allman", { allowSingleLine: true }],
			"@stylistic/quotes": ["error", "double"],
			"@stylistic/semi": ["error", "always"],
			"@typescript-eslint/explicit-member-accessibility": "error",
			"@typescript-eslint/no-explicit-any": "error",
			"@typescript-eslint/naming-convention":
			[
				"error",
				{ selector: "class", format: ["PascalCase"] },
				{ selector: "interface", format: ["PascalCase"], prefix: ["I"] },
				{ selector: "typeAlias", format: ["PascalCase"] },
				{ selector: "enum", format: ["PascalCase"] },
				{ selector: "enumMember", format: ["PascalCase"] },
				{ selector: "parameter", format: ["camelCase"], leadingUnderscore: "require" },
				{ selector: "memberLike", modifiers: ["private"], format: ["camelCase"], trailingUnderscore: "require" },
				{ selector: "memberLike", modifiers: ["protected"], format: ["camelCase"], trailingUnderscore: "require" },
				{ selector: "memberLike", modifiers: ["public"], format: ["PascalCase"] },
				{ selector: "memberLike", modifiers: ["static", "readonly"], format: ["PascalCase"], prefix: ["k"] },
				{ selector: "variable", format: ["camelCase", "PascalCase"] },
				{ selector: "function", format: ["PascalCase"] },
			],
			"scouter/function-separator": "error",
			"scouter/file-header": "error",
			"scouter/no-loop-i": "error",
			"scouter/member-groups": "warn",
			"scouter/file-name": "error",
		},
	},
	{ files: ["Source/Scouter.Gui/**"], rules: { "no-restricted-imports": ["error", { patterns: ["electron", "node:*", "@scouter/app*"] }] } },
	{ files: ["Plugins/**", "Source/Scouter.App/Renderer/BuiltIn/**"], rules: { "no-restricted-imports": ["error", { patterns: ["@scouter/app/*", "../../Renderer/*"] }] } },
	{ files: ["**/*.test.ts"], rules: { "scouter/function-separator": "off", "scouter/member-groups": "off" } },
);
```

### 커스텀 룰 구현 — `function-separator`

```mermaid
flowchart TD
	A[MethodDefinition 방문] --> B{getter/setter 1줄?}
	B -- yes --> Z[통과]
	B -- no --> C[getCommentsBefore]
	C --> D{마지막 2개 주석 중\n/^\/{4,}$/ 이 있고\n그 다음 주석이 설명인가?}
	D -- no --> E[report + fix: 구분선 삽입]
	D -- yes --> F{구분선 길이 == 90 - indent*4?}
	F -- no --> G[report + fix: 길이 수정]
	F -- yes --> Z
```

```js
// Scripts/EslintPlugin/rules/function-separator.mjs
export default {
	meta: { type: "layout", fixable: "whitespace", messages: { missing: "메서드 위에 //// 구분선과 설명 주석이 필요합니다", length: "구분선 길이는 {{expected}}이어야 합니다" } },
	create(context)
	{
		const src = context.sourceCode;
		return {
			MethodDefinition(node)
			{
				if ((node.kind === "get" || node.kind === "set") && node.loc.start.line === node.loc.end.line)
					return;
				const comments = src.getCommentsBefore(node);
				const sep = comments.at(-2);
				const desc = comments.at(-1);
				const indent = node.loc.start.column;              // 탭 = 1커럼
				const expected = 90 - indent * 4;
				if (sep === undefined || desc === undefined || sep.type !== "Line" || !/^\/{2,}$/.test(sep.value))
				{
					context.report({ node, messageId: "missing", fix: (f) => f.insertTextBefore(node, `${"/".repeat(expected)}\n${"\t".repeat(indent)}// TODO: 설명\n${"\t".repeat(indent)}`) });
					return;
				}
				if (sep.value.length + 2 !== expected)
					context.report({ node: sep, messageId: "length", data: { expected }, fix: (f) => f.replaceText(sep, "/".repeat(expected)) });
			},
		};
	},
};
```

같은 요령으로 `file-header`(파일 첫 토큰이 `/*` 블록 헤더인지 — 설명이 3자 미만이면 report), `no-loop-i`(`ForStatement.init` 선언자 이름이 `i/j/k`이면 report, fix는 없음), `member-groups`(`ClassBody` 안 `// ==================== X ====================` 주석 순서가 정의된 순서의 부분순열인지), `file-name`(export된 첫 클래스 이름 == 파일 이름). 룰마다 `RuleTester` 테스트 `Scripts/EslintPlugin/tests/*.test.mjs`.

### tsconfig.base.json

```json
{
	"compilerOptions":
	{
		"target": "ES2023", "module": "ESNext", "moduleResolution": "Bundler",
		"strict": true, "noImplicitOverride": true, "noUncheckedIndexedAccess": true, "exactOptionalPropertyTypes": true,
		"noFallthroughCasesInSwitch": true, "noPropertyAccessFromIndexSignature": true, "useUnknownInCatchVariables": true,
		"experimentalDecorators": false, "isolatedModules": true, "verbatimModuleSyntax": true,
		"lib": ["ES2023", "DOM", "DOM.Iterable"], "types": ["node"],
		"paths": { "@scouter/gui": ["Source/Scouter.Gui/Index.ts"], "@scouter/plugin-api": ["Source/Scouter.PluginApi/Index.ts"] }
	}
}
```

`@RegisterWindow("Shell")` 데코레이터는 **TC39 표준 데코레이터**(TS 5 기본) 형식으로 작성(`experimentalDecorators` off). 시그니처: `(_target: typeof Window, _ctx: ClassDecoratorContext) => void`.

## 2.4 이름 규칙 — 영역별

| 영역 | 규칙 | 예 |
|---|---|---|
| XML 태그·속성 | WPF 이름 PascalCase(D-03) | `<StackPanel Orientation="Horizontal">` |
| XML `Name` | snake_case, 접두 `btn_ txt_ lst_ num_ tab_ dot_ pnl_` 권장 | `btn_run`, `lst_files` |
| DOM class | `gui-{control}`, `gui-{control}__{part}`, 상태 `is-*`, 변형 `variant-*` | `gui-button variant-primary is-pressed` |
| CSS 변수 | 테마 토큰 원본 `--background-base`, 컨트롤 별칭 `--gui-*` | `--gui-control-height` |
| 설정 키 | PascalCase 점(D-12) | `Ui.SidebarWidth`, `Plugins.P4Util.DefaultDepot` |
| EventBus | `Scouter.X`, `{PluginId}.X` | `Scouter.ThemeChanged` |
| MCP Tool | `{PluginId}__{Tool}` | `ScouterCore__ThemeSet` |
| MCP Resource | `scouter://{PluginId}/{path}` | `scouter://P4Util/recipes/extract-files` |
| Command | `{Owner}.{Name}` | `Shell.ToggleSidebar`, `P4Util.CopyPrompt` |
| 테스트 | `describe("클래스")`, `it("한국어 문장")` | `it("보간 모드에서는 문자열로 결합한다")` |

## 2.5 코드비하인드 관례

```ts
@RegisterWindow("P4Util/Main")
export class MainControl extends UserControl
{
	// ==================== 멤버 ====================
	private depot_!: TextBox;
	private run_!: Button;
	private log_!: LogView;

	// ==================== 확장점 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// XML 로드 직후. RequireName으로 컨트롤을 잡고 이벤트를 연결한다.
	protected override OnInit(_dataMap: DataMap): void
	{
		this.depot_ = this.RequireName(TextBox, "txt_depot");
		this.run_ = this.RequireName(Button, "btn_run");
		this.log_ = this.RequireName(LogView, "log_output");
		this.run_.Click.Add((_s, _a) => { void this.RunAsync(); });
	}
}
```

- `RequireName`은 없으면 throw(개발 중 즉시 발견). `FindName`은 null 반환(옵션 요소).
- 이벤트 핸들러는 `(_s, _a)` 이름 고정. 비동기 핸들러는 `void this.XxxAsync()`로 호출(`no-floating-promises` 대응).
- XML 이벤트 속성(`Click="OnRunClick"`)도 지원하지만 기본 관례는 `FindName`(A-04).

## 2.6 에러 처리 규칙

| 상황 | 규칙 |
|---|---|
| 프로그래밍 오류(이름 없는 컨트롤, 잘못된 인자) | `throw new Error("[Class] 메시지")` |
| 외부 입력 오류(XML 문법, 사용자 설정, Tool 인자) | 결과 객체 `{ Ok: false, Errors: [...] }` 또는 `null` + `Log.Warn` |
| 복구 가능 실패(p4 연결, 파일 없음) | `Result<T>` 타입(`{ Ok: true, Value } | { Ok: false, Error }`) |
| 로그 접두 | `[ClassName]` 또는 `[PluginId]` |

## 2.7 구현 체크리스트 (P0)

- [ ] `eslint.config.mjs` + 커스텀 플러그인 5개 룰 + RuleTester 테스트 통과
- [ ] 의도적으로 구분선을 빠뜨린 파일을 넣고 `npm run lint`가 실패하는지 확인(CI 가드)
- [ ] `tsconfig.base.json` strict 옵션 전체 on, `npm run typecheck` 통과
- [ ] VS Code `.vscode/settings.json`: `editor.insertSpaces=false`, `eslint.useFlatConfig=true`, 탭 폭 4
