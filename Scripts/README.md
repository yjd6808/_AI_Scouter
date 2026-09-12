# Scripts — 빌드·검사·생성 스크립트

| 스크립트 | 기능 |
|---|---|
| `Build.ps1` | `npm ci` → lint → typecheck → build → unit 순서 실행. 실패 시 중단 |
| `StartUpDebugging.ps1` | 빌드 후 Electron 실행. `-Test`/`-Hidden`/`-LayoutDir` 스위치. 외부 플러그인 볼 때 `--plugin-dir` 대신 `Plugins/` 기본 로드됨 |
| `RunUnit.mjs` | `Source/Scouter.Tests/Unit` + `Integration` 수집 후 `node --test` 실행 |
| `RunE2e.mjs` | `Source/Scouter.Tests/E2E` 수집 후 `node --test` 실행 |
| `LayoutLint.mjs` | XML 레이아웃 검사. `package.json`의 `lint:layout` 경로 목록 참조 |
| `ThemeLint.mjs` | `Source/Scouter.App/Renderer/Theme/Themes` 테마 검사 |
| `GenLayoutSchema.mjs` | 등록 태그·속성으로 레이아웃 스키마 생성 |
| `MakeIcons.mjs` | `Assets/` 트레이 PNG + app ICO 생성 (의존성 없음, node:zlib만) |
| `EslintPlugin/` | 커스텀 룰(`scouter/*`). `npm run test:rules`로 검사 |
| `Testing/` | UI 육안 검증. `Testing/README.md` 참조 |
