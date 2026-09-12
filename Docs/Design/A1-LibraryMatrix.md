# A1. 라이브러리 매트릭스 — 패키지 × 기능 × API × 대안 × 리스크

> 각 문서의 `§ 라이브러리` 절을 하나로 모은 표. 버전은 P0에서 핀하고 이 표와 `package.json`을 함께 갱신(A-07). "자체"는 외부 의존 없이 직접 구현.

## A1.1 런타임 의존 (배포에 포함)

| 패키지 | 버전 | 쓰는 기능 | 사용 API / 방식 | 문서 | 대안(버림) | 리스크 · 주의 |
|---|---|---|---|---|---|---|
| **electron** | LTS(P0 핀) | 앱 쉘, 창, 트레이, IPC, 글로벌 핫키, 캡처, 다이얼로그 | `BrowserWindow({frame:false, webPreferences:{nodeIntegration:true, contextIsolation:false, sandbox:false}})`, `ipcMain.handle`, `Tray`, `globalShortcut`, `webContents.capturePage`, `shell.showItemInFolder`, `nativeTheme`, `app.setLoginItemSettings`, `requestSingleInstanceLock` | 03, 10, 21 | Tauri(Node 런타임 없음) | nodeIntegration 허용 = 동일 PC 개인 도구 전제(D-11). 버전별 Node API 차이(A-08) |
| **@modelcontextprotocol/sdk** | ^1 | MCP 서버/클라이언트 | low-level `Server`, `StreamableHTTPServerTransport`, `setRequestHandler(ListTools/CallTool/ListResources/ReadResource/ListPrompts/GetPrompt)`, `Client` + `StdioClientTransport`/`StreamableHTTPClientTransport`(Upstream) | 15 | 자체 JSON-RPC 구현 | 스펙 변화 빠름 → minor 핀. zod peer 의존 |
| **zod** | sdk peer | sdk 내부용만 | 직접 사용 안 함(Tool 스키마는 JSON Schema) | 15 | — | 중복 스키마 체계 방지 |
| **ajv** + **ajv-formats** | ^8 | Settings/Plugin.json/Theme/Layout/Tool 인자 검증 | `new Ajv({allErrors:true, useDefaults:true})`, `compile`, `addFormats` | 08, 13, 14, 15 | zod, typebox | draft-07 고정. 오류 문구 한글화는 자체 매핑 |
| **esbuild** | ^0.2x | Plugin 런타임 번들 | `build({entryPoints, bundle, format:"esm", platform:"node", plugins:[ScouterExternalsPlugin], outfile:.cache/Index.mjs, sourcemap:"inline"})` | 14 | swc, 런타임 tsc | 바이너리를 `extraResources`로 동반(21). 버전과 Node 타겟 일치 |
| **chokidar** | ^4 | 레이아웃/Plugin/테마 파일 감시 | `watch(paths, {ignoreInitial:true, awaitWriteFinish:{stabilityThreshold:100}})` | 07, 13, 14 | `fs.watch`(Windows 중복 이벤트) | v4는 glob 미지원 → 디렉터리 감시 + 자체 확장자 필터 |
| **croner** | ^9 | 업데이트 주기 확인, 로그 회전 타이머 | `new Cron("0 */6 * * *", fn)` | 21, 08 | setInterval | 가벼움, 의존 0 |
| **electron-updater** | ^6 | 자동 업데이트 | `autoUpdater.setFeedURL({provider:"generic", url})`, `checkForUpdates`, `quitAndInstall` | 21 | 자체 다운로드 | 사내 URL 미정(사용자 확인 #10). 코드 사이닝 없으므로 SmartScreen 경고 |
| **monaco-editor** | 0.5x | CodeEditor/DiffView(P10) | `editor.create`, `editor.createDiffEditor`, `editor.defineTheme`(ThemeManager 토큰에서 생성) | 12, 13 | CodeMirror 6 | 번들 크기(언어 최소화: xml, json, ts, markdown, plaintext). `monaco-editor-webpack-plugin` |
| **marked** | ^15 | MarkdownView(Recipes, Docs) | `marked.parse(md, {gfm:true})` | 12, 16, 19 | markdown-it | 보안: 반드시 dompurify 후 삽입 |
| **dompurify** | ^3 | 마크다운 HTML 정화 | `DOMPurify.sanitize(html, {ALLOWED_URI_REGEXP})` | 12 | — | `scouter://` 링크 허용 설정 필요 |
| **lucide-static** | latest | 아이콘 SVG 스프라이트 | 빌드 시 `Scripts/GenIcons.mjs`가 필요 아이콘만 `Styles/Icons.svg`로 | 09 | Fluent icons | 런타임 의존 아님(빌드에만) |

## A1.2 개발 의존

| 패키지 | 버전 | 기능 | 사용 방식 | 문서 | 대안 | 주의 |
|---|---|---|---|---|---|---|
| **typescript** | ~5.6 | 전체 | `strict`, `experimentalDecorators:false`(TC39 데코레이터), `useDefineForClassFields`, project references(workspaces) | 02, 03 | — | 데코레이터 때문에 strip-types 테스트 불가(D-25) |
| **webpack** ^5.9 + **ts-loader** ^9 + **css-loader** ^7 + **style-loader** ^4 + **copy-webpack-plugin** ^12 + **html-webpack-plugin** ^5 + **monaco-editor-webpack-plugin** ^7 | | main/renderer/harness 번들 | `webpack/{common,main,renderer,harness}.cjs`; `target: electron-main|electron-renderer`; CSS는 style-loader(테마가 런타임 `<style>` 생성하므로 추출 안 함); XML은 copy | 03 | vite, esbuild-loader | `asset/source`로 md/xml 문자열 로드(16 Docs) |
| **electron-builder** ^25 | | NSIS 패키징 | `electron-builder.yml` (21.6) | 21 | electron-forge | `extraResources` 경로가 `process.resourcesPath` 기준 |
| **eslint** ^9 + **typescript-eslint** ^8 + **@stylistic/eslint-plugin** ^3 + **eslint-plugin-import-x** ^4 + `Scripts/EslintPlugin/` | | 02 컨벤션 강제 | flat config; 커스텀 룰 `function-separator`, `file-header`, `no-loop-i`, `member-groups`, `file-name`(02 §2.5); stylistic `brace-style: allman`, `indent: tab` | 02 | prettier(D-08) | 커스텀 룰은 테스트 필수 |
| **tsx** | latest | 테스트 TS 실행 | `node --import tsx --test` | 20 | ts-node, strip-types | 데코레이터 지원 |
| **happy-dom** ^17 | | L2 DOM 테스트 | `GlobalRegistrator.register()` + Setup.ts 스텁 | 20 | jsdom | `getBoundingClientRect` 0 → 크기 검증은 L4로 |
| **playwright** ^1.5 | | E2E Electron 기동 | `_electron.launch({args})`, 조작은 Test API | 20 | spectron(폐기) | Linux xvfb |
| **c8** ^10 | | 커버리지 | `c8 --check-coverage --lines 70` | 20 | nyc | tsx 소스맵 연동 확인 |
| **@xmldom/xmldom** ^0.9 | | LayoutLint / GenLayoutSchema(Node) | `new DOMParser().parseFromString` | 07 | fast-xml-parser | 런타임은 브라우저 DOMParser(D-20) |
| **svgo** | | 아이콘 스프라이트 최적화 | GenIcons.mjs | 09 | — | — |
| **concurrently** ^9, **electronmon** ^2, **wait-on** ^8, **cross-env** ^7, **rimraf** ^6 | | dev 스크립트 | `npm run dev` = webpack watch ×3 + electronmon | 03 | nodemon | Windows PowerShell 호환 확인 |
| **@types/node** ^22 | | — | — | 03 | — | Electron Node 버전과 맞추기 |
| **adm-zip** (후보) | | PluginPack | `Scripts/PluginPack.mjs` | 21 | archiver, `zip` CLI | 사용자 확인 #7 |
| **@modelcontextprotocol/server-filesystem** (검증용) | | Upstream 프록시 테스트 | stdio upstream | 15 | — | 테스트에만 |

## A1.3 자체 구현 (의도적)

| 기능 | 구현 | 크기 | 문서 | 버린 라이브러리 |
|---|---|---|---|---|
| UI 프레임워크 | `@scouter/gui` (UIElement/UIProperty/RoutedEvent/Panels/Controls) | 약 8k줄 | 04–06, 09, 11, 12 | react/vue |
| XML 로더·바인딩 | XmlLoader, BindingResolver(토커나이저+재귀 하강), DataList | 약 1.5k | 07 | jsep |
| HTTP 라우터 | Router 40줄 on `node:http` | | 15, 20 | express/fastify |
| Settings | ajv + 자체 저장(원자적 쓰기, 디바운스) | | 08 | electron-store |
| 로그 | Log + FileSink(일별 회전) + RingBuffer | | 08 | electron-log, winston |
| 테마 | ThemeResolver/ThemeCss (opencode 이식) | | 13 | — |
| fuzzy | `Fuzzy.Score` 60줄 | | 18 | fuse.js |
| p4 | Spawn + ZtagParser | | 19 | p4api |
| 가상 리스트 | VirtualList(고정 높이) | | 12 | react-window |
| 인자 파싱 | `node:util.parseArgs` | | 03 | yargs |
| 버전 범위 | 3자리 비교 20줄 | | 14 | semver |
| 토큰/인증 | `node:crypto` randomBytes/timingSafeEqual | | 15 | jsonwebtoken |

## A1.4 버전 핀 기록 (P0에서 갱신)

| 패키지 | 핀 버전 | 핀 날짜 | 비고 |
|---|---|---|---|
| electron | (P0) | | Node 버전 = ? |
| typescript | | | |
| @modelcontextprotocol/sdk | | | |
| esbuild | | | |
| monaco-editor | | | |
