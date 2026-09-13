# TypeScript 가이드 — Plugin 코드 작성법

> 대상: Plugin의 TS 파일(`Index.ts`, `Tools/*.ts`, `Views/*.ts` 등)을 작성하는 사람.
> 화면 선언은 [LayoutXml.md](LayoutXml.md), 전체 절차는 [../Plugin/Guide.md](../Plugin/Guide.md).
> 코딩 컨벤션 원문: `Docs/Design/02-CodingConvention.md`. API 계약 원문: `Source/Scouter.PluginApi/*.ts`.

## 1. 한 줄 정의

Plugin TS는 세 종류다. 진입점(`Index.ts`, 등록만), 도구(`Tools/`, MCP로 호출됨), 화면 코드(`Views/`, XML과 짝). 셋 다 규칙이 정해져 있어서 외우기보다 복사해서 쓰면 된다.

## 2. 왜 필요한지

Scouter Plugin은 Electron 렌더러 안에서 `esbuild`로 묶여 `require`로 로드된다(`PluginBundler.ts`).
그래서 Node 전용 API는 쓸 수 없고(브라우저 환경), `electron` 직접 접근도 금지다. 필요한 건 전부 `IPluginContext` 창구로 받는다.
이 제약을 어기면 로드 실패 → 사이드바 느낌표(`!`)가 뜬다.

## 3. 금지·필수 규칙 (어기면 빨강)

| 구분 | 내용 | 근거 |
|---|---|---|
| 탭 들여쓰기, Allman 브레이스 | Prettier 사용 안 함 | `eslint.config.mjs` |
| `public/protected/private` 명시 | 생략 금지 | `explicit-member-accessibility` |
| `any` 금지 | `unknown` + 타입 가드 | `no-explicit-any` |
| 이름 규칙 | 클래스 PascalCase, 인터페이스 `I` 접두, 파라미터 `_` 접두, private/protected 멤버 `_` 접미, 루프 카운터 `idx`(`i` 금지) | `naming-convention`, `scouter/no-loop-i` |
| 메서드 구분선 | `////`(90 − 들여쓰기×4) + 설명 주석. 1줄 getter/setter는 생략 가능 | `scouter/function-separator` |
| 파일 1개 = 클래스 1개 | 파일명 == 클래스명(PascalCase) | `scouter/file-name` |
| 멤버 그룹 순서 | 정적 → 멤버 → 생성·소멸 → 속성 → 이벤트 → 공개 → 확장점 → 내부 | `scouter/member-groups` |
| import 금지 | `electron`, `node:*`, `@scouter/app/*`, `../../Renderer/*` (Plugin·내장 공통) | `no-restricted-imports` |
| `require("electron")` 금지 | View에서 직접 호출 금지. 필요하면 `static Configure`로 주입 | `Plugins/AGENTS.md` §5 |

## 4. 진입점 `Index.ts`

하는 일은 등록뿐이다. 로직을 넣지 않는다.

```ts
export default class NotesPlugin extends PluginBase
{
	protected override OnActivate(_ctx: IPluginContext): void
	{
		const store = new NoteStore(_ctx.Fs, `${_ctx.Paths.StorageDir}/notes`);
		const fallback = (): string => _ctx.Settings.Get<string>("DefaultNote", "inbox");
		_ctx.Tools.Register(new AppendTool(store, fallback));
		_ctx.Ui.RegisterWindow("Main", MainControl);
		MainControl.Configure(store, fallback);
		void this.RegisterRecipesAsync(_ctx);
		_ctx.Prompts.Register("Notes", { Description: "...", Build: () => "..." });
	}
}
```

- `PluginBase` 수명: `Activate(ctx)` → `OnActivate` → … → `Deactivate()` → `OnDeactivate()`. 소스: `Source/Scouter.PluginApi/PluginBase.ts`.
- 설정 읽기는 **스냅샷 금지**. `const x = Get(...)` 한 번 읽기가 아니라 위처럼 getter 함수로 넘긴다. E2E가 설정을 바꿔도 실행 시점에 읽히게 하려는 것이다.
- View는 `ctx`를 받을 수 없으니 `static Configure`로 1회 주입한다(P4Util/Notes/ToastLab/ControlLab 공통 패턴).
- `OnActivate`는 10초 타임아웃이 있다. 무거운 초기화 금지. 레시피 등록처럼 실패해도 되는 것은 `void this.XxxAsync()` + 내부 try/catch.

## 5. `IPluginContext` 창구표

원문: `Source/Scouter.PluginApi/IPluginContext.ts`. 구현: `Source/Scouter.App/Renderer/Plugin/PluginContext.ts`.

| 창구 | 주요 메서드 | 비고 |
|---|---|---|
| `Settings` | `Get(key, def)` / `Set` / `On` | 키는 자동 접두. `Get("DefaultNote")` = `Plugins.{Id}.DefaultNote`. 전역(`Theme.*`) 접근 불가 |
| `Storage` | `Get` / `Set` / `Delete` | `storage.json` 단순 저장소 |
| `Secrets` | `Get` / `Set` / `Delete` (async) | `Secrets` 권한 필요 |
| `Logger` | `Debug/Info/Warn/Error` | `[Plugin:{Id}]` 스코프. `/test/logs`로 확인 |
| `Events` | `On` / `Emit` | `Emit`은 `{Id}.{name}`으로 발행. 구독은 `EventBus` 직접명 |
| `Tools` | `Register(tool)` / `Invoke(fullName, args)` | MCP명은 `{Id}__{Tool명}` 자동. `Invoke`는 `Tools.Invoke` 권한 필요 |
| `Resources` / `Prompts` | `Register(...)` | 레시피·프롬프트 등록 |
| `Commands` | `Register(name, {Title, Hotkey?, Run})` | 명령 Id는 `{Id}.{name}`. 팔레트에 자동 노출 |
| `Hotkeys` | `Bind(gesture, handler)` | 앱 전역 단축키 |
| `Shell` | `Exec(cmd, args, opts)` / `SetStatus` / `SetBadge` | `Exec`는 `Process` 권한 필요 |
| `Fs` | `ReadText` / `WriteText` / `ReadDir` / `Exists` | `StorageDir`·`PluginDir` 안은 자유. 밖은 `Fs.Read`/`Fs.Write` 권한. 경로 탈출(`..`·`/`) 검증 필수 |
| `Http` | `Fetch` | `Network` 권한 필요 |
| `Clipboard` | `ReadText` / `WriteText` | `Clipboard` 권한 필요 |
| `Schedule` | `Cron` / `Interval` | Plugin 해체 시 자동 해제 |
| `Worker` | `Run(script, args)` | Web Worker 실행 |
| `Paths` | `PluginDir` / `StorageDir` / `UserDataDir` / `Temp` | 절대경로 조립용 |
| `Ui` | `RegisterWindow` / `Show` / `Toast` / `Notify` / `NotifyGlobal` / `MessageBox` / `Confirm` | 화면·알림 |
| `App` | `Version` / `Plugins()` | 앱 정보 조회 |

## 6. Tool 작성 (`Tools/{X}Tool.ts`)

계약 원문: `Source/Scouter.PluginApi/ITool.ts` — `Name`/`Description`/`InputSchema` + `Run(_args, _call): Promise<unknown>`.

```ts
export class AppendTool implements ITool
{
	public readonly Name = "Append";
	public readonly Description = "메모에 1건을 추가한다.";
	public readonly InputSchema = {
		type: "object",
		properties: { Note: { type: "string" }, Text: { type: "string" } },
		required: ["Text"],
	};
	public readonly DefaultApproval = "auto" as const; // 쓰기·저위험(자기 영역)이라 승인 없이 둔다
	public constructor(_store: NoteStore) { ... }

	public Run(_args: Record<string, unknown>, _call: IToolCall): Promise<unknown>
	{
		const parsed = ReadAppendArgs(_args); // 인자 검증은 분리 함수. 실패는 throw
		...
		return Promise.resolve({ Ok: true, ... });
	}
}
```

| 종류 | 선언 |
|---|---|
| 읽기 전용 | `Annotations = { ReadOnly: true }` → 승인 auto |
| 쓰기·저위험(자기 notes·화면 표시 등) | `DefaultApproval = "auto"` (사유 주석 필수) |
| 위험 | `Annotations = { Destructive: true }` 또는 미선언 → 기본 ask |

주의 3개:

1. 실패는 `throw` (문자열 반환 금지). 단, `Run` 안에서 **동기 throw 금지** — `Promise.reject`로 감싼다. `assert.rejects` 계열 테스트가 동기 throw를 못 잡기 때문이다.
2. 이상한 입력은 기본값으로 굳힌다(예: 이상한 Kind → `"info"`). 외부 입력이 Tool을 깨뜨리면 안 된다.
3. Tool 1개 = 파일 1개. `Plugin.json`의 `Tools` 배열과 실제 등록이 일치해야 한다(어긋나면 경고·에러 로그).

## 7. 화면 코드 (`Views/MainControl.ts`)

관례 원문: `Docs/Design/02-CodingConvention.md` §2.5. 참고 구현: `Plugins/ControlLab/Views/MainControl.ts`(전 컨트롤 바인딩 예시).

```ts
export class MainControl extends UserControl
{
	private static s_store_: ControlStore | null = null;
	private data_!: DataList;

	public static Configure(_store: ControlStore): void
	{
		MainControl.s_store_ = _store;
	}

	protected override OnInit(_data: DataList): void
	{
		this.data_ = _data;
		this.FindName(Button, "btn_save")?.Click.Add(() => { void this.OnSaveAsync(); });
		this.FindName(TextBox, "txt_input")?.TextCommitted.Add(() => { ... });
		this.FindName(NumericUpDown, "num_demo")?.ValueChanged.Add((_s, _a) => { ... _a.NewValue ... });
		const list = this.FindName(ListBox, "lst_demo");
		list?.SetItems(["첫째", "둘째"]);
		list?.SelectionChanged.Add(() => { ... });
		this.data_.Set("eventCount", 0); // 바인딩 갱신
	}
}
```

- `RequireName`은 없으면 throw(개발 중 오타 즉시 발견). `FindName`은 null 반환(옵션 요소).
- 이벤트 핸들러 인자명은 `(_s, _a)` 고정. 비동기는 `void this.XxxAsync()`로 호출.
- 목록 계열은 XML에 자식을 두지 말고 코드에서 `SetItems`로 채운다. `TreeView`는 어댑터(`HeaderOf`/`ChildrenOf`/`HasChildren`)가 필수다.
- 우클릭 메뉴: `const menu = new ContextMenu(); const item = new MenuItem(); item.Header = "..."; item.Click.Add(...); menu.AddItem(item); control.ContextMenu = menu;`
- `DataList` API: `Set(key, value)` / `Get(key)` / `Update(patch)` / `Has(key)` / `Snapshot()` / `Restore()`. 소스: `Source/Scouter.Gui/Xml/DataList.ts`.

## 8. 파일별 역할 정리

| 파일 | 역할 | 소스에서 볼 것 |
|---|---|---|
| `Plugin.json` | 매니페스트. 스키마가 정답 | `Source/Scouter.App/Config/Plugin.schema.json` |
| `Index.ts` | 등록만. `PluginBase` 상속, default export | `Source/Scouter.PluginApi/PluginBase.ts` |
| `Types.ts` | 공용 타입 + 싱크 타입 | `Plugins/ToastLab/Types.ts` 예시 |
| `*Store.ts` | 상태·외부연동 클래스. `ctx` 대신 주입받게 설계(단위 테스트에서 가짜 주입) | `Plugins/Notes/NoteStore.ts` |
| `Tools/*.ts` | `ITool` 1개씩 | `Source/Scouter.PluginApi/ITool.ts` |
| `Views/*.ts` | `UserControl` + `OnInit` + `static Configure` | `Plugins/ControlLab/Views/MainControl.ts` |
| `Layout/*.xml` | 화면 선언 | [LayoutXml.md](LayoutXml.md) |
| `Recipes/*.md` | 외부 AI용 절차서. 최소 1개 | `Plugins/Notes/Recipes/Notes.md` |
| `Settings.schema.json` | 있으면 자동 등록(생략 가능) | `Plugins/Notes/Settings.schema.json` |

## 9. 한 줄 요약

등록은 `Index`, 계약은 `ITool`, 화면은 `OnInit+Configure`, 설정은 getter, 실패는 throw, `electron` 손대기 금지 — 이 여섯 줄이 TS 작성법 전부다.
