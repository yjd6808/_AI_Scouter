# Plugin 개발 가이드

> 외부 Plugin(`Plugins/{Id}/`)을 새로 만들거나 고치는 절차 전체. AI용 체크리스트는 `Plugins/AGENTS.md`.
> 화면 선언법: [../Program/LayoutXml.md](../Program/LayoutXml.md). TS 작성법: [../Program/TypeScript.md](../Program/TypeScript.md).
> 설계 원문: `Docs/Design/14-Plugin-System.md`(매니페스트·로더·권한), `19-Plugin-P4Util.md`(풍부한 예제).

## 1. 한 줄 정의

Plugin은 폴더 1개(`Plugins/{Id}/`) + 매니페스트(`Plugin.json`) + 진입점(`Index.ts`) + 화면(`Layout/`+`Views/`) + 도구(`Tools/`)다. 이 뼈대를 복사하고 이름만 바꾸면 절반은 끝난다.

## 2. 왜 이 구조인지

Scouter는 로컬 유틸리티 허브다. 새 기능 = 새 Plugin이고, Plugin = MCP Tool(외부 AI가 호출) + 사이드바 화면(사람이 클릭)이다.
뼈대가 고정돼 있으니 검증(린트·타입·단위·E2E)이 기계적으로 돌고, 권한·설정·리소스도 자동으로 엮인다.
마치 콘센트 규격이 정해져 있으면 어떤 가전도 꽂기만 하면 되는 것과 같다.

## 3. 개발 순서 (따라 하기)

```
1. 뼈대 복사    → Plugins/Notes/(간단) 또는 Plugins/P4Util/(복잡) 중 택1 복사 후 Id만 교체
2. Plugin.json  → §4 표대로 작성. 폴더명 == Id
3. Index.ts     → Tool·화면·레시피·프롬프트 등록 (로직 금지)
4. Tools/       → Tool 1개 = 파일 1개 (§5)
5. Layout+Views → 화면 선언 + OnInit 바인딩 (§6, ../Program/LayoutXml.md)
6. package.json → typecheck·lint:layout에 경로 2곳 추가 (§7)
7. 테스트       → Unit + E2E (포트 9531번부터, §8)
8. 검증 체인    → lint → typecheck → build → test:unit → test:e2e
9. 배포         → 설치된 앱 옆 Plugins/에 통째로 복사 (§9)
```

참고 구현 고르기: 화면 없이 Tool만이면 ToastLab의 Tool 2종, 목록+본문 화면이면 Notes, 설정+탭+로그 화면이면 P4Util, 전 컨트롤 예제가 필요하면 ControlLab을 본다.

## 4. `Plugin.json` 작성

정답 스키마: `Source/Scouter.App/Config/Plugin.schema.json`.

| 키 | 필수 | 규칙 |
|---|---|---|
| `Id` | ○ | 폴더명과 동일. `^[A-Z][A-Za-z0-9]*$` (대문자 시작 영숫자) |
| `Name` | ○ | 사이드바 표시명. 1자 이상 |
| `Version` | ○ | `x.y.z` 형식 |
| `Main` | ○ | 진입점. 보통 `"Index.ts"` |
| `Layout` | ○ | 메인 화면 XML. 보통 `"Layout/Main.xml"` |
| `Description`/`Author` | — | 설명·작성자 |
| `Icon` | — | 사이드바 아이콘. 이미 등록된 lucide명 권장(`package`, `search` 등. `IconSprite.ts` 목록) |
| `MinAppVersion` | — | 기본 `"0.4.0"` |
| `Permissions` | — | 필요한 것만. `Process`/`Fs.Read`/`Fs.Write`/`Clipboard`/`Settings`/`Secrets`/`Network`/`Tools.Invoke`. 비어 있으면 권한 다이얼로그가 안 뜬다 |
| `Settings` | — | 있으면 자동 등록. 보통 `"Settings.schema.json"` (생략 가능) |
| `Tools` | — | 실제 등록과 1:1 대조. 어긋나면 경고·에러 로그 |
| `Commands` | — | 실제 등록과 1:1 대조 |
| `Hotkeys` | — | `{}` 로 둔다 |

최소 예시 (`Plugins/ToastLab/Plugin.json` 발췌):

```json
{
	"Id": "ToastLab", "Name": "Toast Lab", "Version": "0.1.0",
	"Main": "Index.ts", "Layout": "Layout/Main.xml", "Icon": "bell",
	"MinAppVersion": "0.4.0", "Permissions": [],
	"Tools": ["Notify", "Message"], "Commands": [], "Hotkeys": {}
}
```

## 5. Tool·화면 작성

상세는 각 문서로 위임한다. 여기서는 연결 관계만 기억한다.

- Tool: [../Program/TypeScript.md](../Program/TypeScript.md) §6. MCP 전체 이름은 `{Id}__{Tool명}` 자동 생성(예 `ControlLab__State`).
- 화면: [../Program/LayoutXml.md](../Program/LayoutXml.md) + [../Program/TypeScript.md](../Program/TypeScript.md) §7. `ctx.Ui.RegisterWindow("Main", MainControl)` → 사이드바 Id는 `{Id}/Main`.
- 설정: `ctx.Settings.Get("키")` = `Plugins.{Id}.{키}`. getter로 넘기고 스냅샷 금지.
- 레시피: `Recipes/{Id}.md` 최소 1개 + `Resources.Register("recipes/{Id}", ...)` + `Prompts.Register`. `Plugins/Notes/Recipes/Notes.md`가 가장 짧은 예시다.

## 6. 파일 뼈대 (복사 체크리스트)

```
Plugins/{Id}/
	Plugin.json            # §4
	package.json           # {"name":"소문자","version":"0.1.0","type":"module","private":true}
	tsconfig.json          # base 확장, composite=false, noEmit, include 명시(아래)
	Index.ts               # default export PluginBase. 등록만
	Types.ts               # 공용 타입
	{Domain}Store.ts       # 상태·외부연동 클래스. 가짜 주입 가능하게 (Notes NoteStore 참고)
	Tools/{X}Tool.ts       # Tool 1개 = 1파일
	Views/MainControl.ts   # UserControl 1개. OnInit + static Configure
	Layout/Main.xml        # UserControl 루트
	Recipes/{Id}.md        # 최소 1개
	Settings.schema.json   # 선택
```

`tsconfig.json` 정석:

```json
{
	"extends": "../../tsconfig.base.json",
	"compilerOptions": { "composite": false, "noEmit": true },
	"include": ["Index.ts", "Types.ts", "{Domain}Store.ts", "Tools/**/*.ts", "Views/**/*.ts", "Layout/**/*"]
}
```

## 7. `package.json` 등록 (잊으면 CI 빨강)

루트 `package.json`의 2곳에 경로를 추가한다:

```json
"typecheck": "... Plugins/ToastLab Plugins/ControlLab Plugins/{Id}",
"lint:layout": "... Plugins/ToastLab/Layout Plugins/ControlLab/Layout Plugins/{Id}/Layout",
```

## 8. 테스트

- 단위: `Source/Scouter.Tests/Unit/Plugin/{Id}.test.ts`. 파일 1개에 `describe("{Id}")`. 외부연동은 가짜 객체 주입(Notes `MemoryFs`, ToastLab 싱크 주입 참고).
- E2E: `Source/Scouter.Tests/E2E/{Id}.test.ts`. 포트 규칙 — 9521 Shell, 9522 Mcp, 9523/9524 P4Util, 9525 팔레트, 9526 Notes, 9527 Theme, 9528 ToastLab, 9529 ControlLab, 9530 SidebarNotice 사용 중. **신규는 9531번부터.**
- 스폰 인자: `dist/main/Main.cjs --test --hidden --no-auth --port {N} --plugin-dir Plugins`. 새 Plugin은 자동 발견. StorageDir은 pid별 temp라 격리됨.
- 승인 필요 Tool은 `before`에서 `POST /test/approval {Policy:"allow"}`. `auto`/`ReadOnly` Tool은 생략 가능.
- 화면 확인: `GET /test/find?name={Name}` (타입·가시성·Rect), 클릭 `POST /test/click {Name}`, 임의 스크립트 `POST /test/eval {Script}`. E2E 합성 클릭은 hit-testing을 우회하므로, 클릭 계열 수정 뒤에는 `Scripts/Testing/` 실마우스로 재확인한다.
- 파일 변경 감지(dirty dot)를 E2E에서 건드리려면 Plugin 폴더에 probe 파일을 쓰고 지운다. 원본 복원은 바이트 단위 되돌리기 + `after` 정리. 선례: `Source/Scouter.Tests/E2E/SidebarNotice.test.ts`.
- 서버·바이너리 의존이면 `SCOUTER_X_MODE` + `t.skip()` 분기 (P4Util 선례).

## 9. 동작·배포 메모

- 첫 실행에 `Permissions` 기준 권한 다이얼로그가 뜬다(최소 선언). E2E는 `/test/permission` 또는 선언 축소.
- 파일 저장 → 300ms 디바운스 후 처리. **`.xml`은 자동 리로드**, `.ts`/`.json`/`.css`는 사이드바 빨간 점(dirty) + 수동 리로드(우클릭 메뉴·F5·`Shell.ReloadPlugin` 명령). 리로드 실패하면 느낌표(`!`). `.md` 등은 무시.
- `OnActivate` 10초 타임아웃 초과, 또는 `Tools` 선언·등록 불일치 → E2E에서 Tool이 안 보인다.
- 배포판: 설치된 앱(`Scouter.exe` 옆 `Plugins/` 폴더)에 `{Id}/` 통째로 복사 → 재시작 후 자동 로드. 넣을 때는 `tsconfig`·`.cache` 없이 소스만(앱이 esbuild로 번들). `~/.scouter/plugins`와 Id가 겹치면 나중 스캔이 우선.

## 10. 흔한 실패

| 증상 | 원인 |
|---|---|
| 사이드바에 오류 뷰(느낌표) | `Layout` 경로 오타·XML 파싱 실패·TS 오류. 로그(`/test/logs`) 확인 후 고치고 다시 로드 |
| 권한 다이얼로그 무한 대기 | `Permissions` 과다 선언 |
| E2E에서 Tool 없음 | `OnActivate` 타임아웃 또는 선언·등록 불일치 |
| 설정이 안 먹음 | 스냅샷 저장. getter로 바꿀 것 |
| `tsc -b`에 새 Plugin 누락 | §7 미등록 |
| 탭이 안 바뀌고 내용이 겹침 | 구버전. `TabControl`은 직접 붙인 TabItem을 자동 채택한다(현행 정상) |

## 11. 한 줄 요약

뼈대 복사 → `Plugin.json` → `Index` 등록 → `Tools`+화면 → 경로 2곳 등록 → 테스트 2종 → 검증 체인. 막히면 ControlLab(예시) → 이 문서 링크들(근거) 순서로 본다.
