# Layout XML 가이드 — 선언형 UI 작성법

> 대상: Plugin 화면(`Plugins/{Id}/Layout/*.xml`)과 내장 화면(`Source/Scouter.App/Renderer/Layout/*.xml`)을 작성하는 사람.
> TS 코드 작성법은 [TypeScript.md](TypeScript.md), Plugin 전체 절차는 [../Plugin/Guide.md](../Plugin/Guide.md).
> 설계 원문: `Docs/Design/07-Xml-Layout-Binding.md`(로더·바인딩), `09/11/12-Gui-Controls-*.md`(컨트롤 명세).

## 1. 한 줄 정의

Layout XML은 화면의 설계도다. TS 코드 한 줄 없이 태그만으로 화면을 선언하면, 로더가 실제 컨트롤 객체로 지어준다.

## 2. 왜 필요한지

같은 화면을 코드로만 짜면 `new Button()` 수십 줄에 이벤트 연결까지 손으로 해야 한다.
XML에 선언해두면 구조가 한눈에 보이고, 린트(`npm run lint:layout`)가 오타·잘못된 속성을 빌드 전에 잡아준다.
마치 건축 설계도면이 있으면 시공(로더)이 알아서 기둥(Button)과 창문(TextBox)을 세우는 것과 같다.

## 3. 로드 파이프라인 (동작 순서)

```
.xml 텍스트
  → XmlLoader.Parse (DOMParser)
  → ElementCatalog.Create (태그명 → 클래스)
  → AttributeApplier.Apply (속성 1개씩: 리터럴/바인딩/붙임/이벤트/커맨드 분기)
  → UIElement.AddChild (부모-자식 조립)
  → BindingGraph (바인딩 초기 평가 + microtask 재평가)
  → UserControl.OnInit (코드비하인드 연결 지점)
```

| 단계 | 소스 파일 |
|---|---|
| 전체 로드·트리 조립 | `Source/Scouter.Gui/Xml/XmlLoader.ts` |
| 태그 → 클래스 등록表 | `Source/Scouter.Gui/Xml/ElementCatalog.ts` (`ScouterCore__ControlCatalog` Tool로도 조회 가능) |
| 속성 적용·보간 판정 | `Source/Scouter.Gui/Xml/AttributeApplier.ts` |
| 식 파서·바인딩 평가 | `Source/Scouter.Gui/Xml/Expression/*`, `BindingResolver.ts`, `BindingGraph.ts` |
| 데이터 저장소 | `Source/Scouter.Gui/Xml/DataList.ts` |
| 린트 규칙 | `Source/Scouter.Gui/Xml/LayoutLint.ts` (실행기 `Scripts/LayoutLint.mjs`) |
| 속성 정의 본체 | `Source/Scouter.Gui/Core/UIProperty.ts` (`Lookup`은 프로토타입 체인을 거슬러 찾는다) |

## 4. 문서 골격

```xml
<?xml version="1.0" encoding="UTF-8"?>
<UserControl xmlns="scouter/gui" Name="myplug_main">
  <UserControl.Data>
    <Item Key="myCount" Type="Int" Value="0" />
    <Item Key="myFlag" Type="Bool" Value="false" />
    <Item Key="myText" Type="String" Value="대기" />
  </UserControl.Data>
  <DockPanel LastChildFill="true">
    <!-- 자식 1개면 자동으로 본문이 된다. 2개 이상이면 ContentHost="true"가 하나 있어야 한다(E002) -->
  </DockPanel>
</UserControl>
```

- 루트는 `Window`(앱 다이얼로그용) 또는 `UserControl`(Plugin 화면용)만 된다(E001).
- `xmlns="scouter/gui"` 고정. `Name`은 snake_case 권장(W040), 중복 금지(E030).
- `UserControl.Data`의 `Type`은 `Int`/`Bool`/`String`만 쓸 것. 코드에서는 `data_.Set("myCount", 3)`으로 갱신한다.

## 5. 바인딩 식

| 형태 | 예시 | 의미 | 소스 |
|---|---|---|---|
| `{@key}` | `Text="{@stateText}"` | Data 단방향 | `BindingResolver` |
| `{{식}}` | `Text="{{@noteCount} + ` notes`}"` | 표현식. 문자열 리터럴은 백틱 | `Expression/Parser` |
| `!{...}` | `IsEnabled="!{@isRunning}"` | 부정 | 동상 |
| 삼항 | `Visibility="{{@isRunning} ? `Visible` : `Collapsed`}"` | 삼항 | 동상 |
| `{$settings...}` | `Text="{$settings.Plugins.P4Util.DefaultDepot}"` | 설정값 구독(변경 시 재평가) | `Services/SettingsSource` |
| `{$theme...}` | `Background="{$theme.background-panel}"` | 테마 토큰 → `var(--*)` (재평가 없음, CSS 변수가 알아서 추종) | `07-Xml-Layout-Binding.md` |
| `{#name.Prop}` | `Target="#txt_depot"` | 같은 화면 요소 참조 | `XmlLoader.MakeScope` |
| 상대 참조 | `$parent`/`$root`/`$self` | 조상·자기 참조 | 동상 |

`Text`/`Content`/`Header`/`Title`/`ToolTip`/`Placeholder`는 항상 보간을 시도한다(`AttributeApplier.ts`의 `kAlwaysInterpolate`).

## 6. 공용 속성 (거의 모든 태그)

| 속성 | 예시 | 설명 |
|---|---|---|
| `Name` | `Name="btn_save"` | 코드(`FindName`)·테스트(`data-testid`)·E2E 클릭용. 상호작용 컨트롤은 필수(W041). 접두 권장: `btn_ txt_ lst_ cmb_ num_ tab_ chk_ radio_ slider_ bar_ tree_ menu_` |
| `Width`/`Height` | `Width="200"`, `Width="*"`, `Width="Auto"` | GridLength. `*`는 남는 공간 분할 |
| `MinWidth`/`MaxWidth`/`MinHeight`/`MaxHeight` | `MinWidth="160"` | 제한 |
| `Margin`/`Padding` | `Margin="12"`, `Margin="12,0,0,0"` | Thickness. 1개·2개·4개 항 |
| `HorizontalAlignment`/`VerticalAlignment` | `Stretch`/`Left`/`Center`/`Right` | 배치 |
| `Visibility` | `Visible`/`Collapsed` | `Collapsed`는 자리도 안 차지 |
| `IsEnabled` | `IsEnabled="!{@isRunning}"` | 자식으로 상속된다 |
| `Background`/`Foreground`/`BorderBrush`/`FontSize`/`FontFamily`/`FontWeight` | `FontSize="15"` | `Control` 계열. 개별 지정은 인라인 스타일(전역 테마보다 우선) |
| `ToolTip` | `ToolTip="저장 (Ctrl+S)"` | 호버 설명. 빈 문자열은 예약 안 함 |
| `Command`/`CommandParameter` | `Command="P4Util.CopyPrompt"` | `CommandRegistry` 명령 실행 |
| `Grid.Row`/`Grid.Column` | `Grid.Column="1"` | 붙임 속성(점 표기) |
| `DockPanel.Dock` | `DockPanel.Dock="Top"` | `Top`/`Bottom`/`Left`/`Right` |
| `Canvas.Left`/`Canvas.Top` | `Canvas.Left="10"` | 절대 좌표. `Right`/`Bottom`/`ZIndex`도 있음 |

## 7. 패널 10종

자식을 배치하는 상자다. 소스: `Source/Scouter.Gui/Panels/*.ts`.

| 태그 | 주요 속성 | 예시 |
|---|---|---|
| `Grid` | 자식 `Grid.Row`/`Grid.Column`. 정의는 `<Grid.RowDefinitions><RowDefinition Height="*"/></Grid.RowDefinitions>` + `<Grid.ColumnDefinitions><ColumnDefinition Width="220" MinWidth="160" MaxWidth="320"/>...` | 아래 Notes 예시 |
| `StackPanel` | `Orientation="Horizontal"`(기본 세로), `Spacing="8"` | `<StackPanel Orientation="Horizontal" Spacing="8" Margin="12">` |
| `DockPanel` | `LastChildFill="true"`, 자식 `DockPanel.Dock` | `<DockPanel LastChildFill="true">` |
| `WrapPanel` | `Orientation`, `ItemWidth`/`ItemHeight` | `<WrapPanel><Button .../>...</WrapPanel>` |
| `Canvas` | 자식 `Canvas.Left`/`Top` | `<Canvas Height="60"><TextBlock Text="절대" Canvas.Left="10" Canvas.Top="10"/></Canvas>` |
| `UniformGrid` | `Rows`/`Columns` (0이면 자식 수로 자동) | `<UniformGrid Columns="2">` + 셀 4개 |
| `Border` | `Padding`, `Background`, `BorderBrush`, `BorderThickness="0,0,0,1"`, `CornerRadius` | `<Border Padding="12" Background="{$theme.background-panel}" BorderBrush="{$theme.border-weak-base}" BorderThickness="0,0,0,1">` |
| `ScrollViewer` | `HorizontalScrollBarVisibility`, `VerticalScrollBarVisibility`(`Auto`/`Hidden`/`Visible`/`Disabled`), `IsAutoScrollToEnd` | `<ScrollViewer><StackPanel>...긴 내용...</StackPanel></ScrollViewer>` |
| `Viewbox` | `Stretch="Uniform"`/`Fill`/`UniformToFill`/`None` | `<Viewbox><TextBlock Text="확대"/></Viewbox>` |
| `GridSplitter` | `Grid.Column="1"`, `ResizeDirection="Columns"` | 너비 8 고정 열 사이에 배치 (Shell.xml 참고) |

목록+본문 정석 구조 (Notes 발췌):

```xml
<DockPanel LastChildFill="true">
  <StackPanel DockPanel.Dock="Top" Orientation="Horizontal" Spacing="8" Margin="12">
    <TextBox Name="txt_title" Width="200" Placeholder="새 노트 이름" />
    <Button Name="btn_save" Content="저장" Variant="Primary" />
  </StackPanel>
  <StatusBar DockPanel.Dock="Bottom">...</StatusBar>
  <Grid>
    <Grid.RowDefinitions><RowDefinition Height="*"/></Grid.RowDefinitions>
    <Grid.ColumnDefinitions>
      <ColumnDefinition Width="220" MinWidth="160" MaxWidth="320"/>
      <ColumnDefinition Width="*" MinWidth="200"/>
    </Grid.ColumnDefinitions>
    <ListBox Name="lst_notes" Grid.Column="0" Margin="12" />
    <TextBox Name="txt_body" Grid.Column="1" AcceptsReturn="true" Margin="12" />
  </Grid>
</DockPanel>
```

## 8. 기본 컨트롤

소스: `Source/Scouter.Gui/Controls/*.ts`. 전체 목록은 `ScouterCore__ControlCatalog` Tool(태그 생략 시 전체 목록) 또는 `ElementCatalog.Names()`로 확인한다.

| 태그 | 주요 속성 | 예시·비고 |
|---|---|---|
| `Button` | `Content`, `Variant="Default/Primary/Danger/Ghost"`, `IsDefault`, `IsCancel`, `Icon="search"` | `<Button Name="btn_save" Content="저장" Variant="Primary" />`. `Button.ts` |
| `RepeatButton` | `Content`, `Delay`, `Interval` | 누르고 있으면 `Click` 반복. `RepeatButton.ts` |
| `ToggleButton` | `Content`, `IsChecked` | `Click`/`Checked`/`Unchecked` 이벤트. `ToggleButton.ts` |
| `CheckBox` | `Content`, `IsChecked` | ToggleButton 상속. `<CheckBox Name="chk_add" Content="add" IsChecked="true" />` |
| `RadioButton` | `Content`, `GroupName`, `IsChecked` | 같은 `GroupName`은 하나만 켜짐. `RadioGroupScope.ts` |
| `TextBlock` | `Text`, `TextWrapping="Wrap"`, `TextTrimming="CharacterEllipsis"`, `TextAlignment`, `FontSize` | 표시 전용. `FontSize` 개별 지정 가능. `TextBlock.ts` |
| `TextBox` | `Text`, `Placeholder`, `IsReadOnly`, `AcceptsReturn="true"`(여러 줄), `MaxLength` | `TextBox.ts` |
| `PasswordBox` | `Password`, `Placeholder` | 마스킹 입력. `PasswordBox.ts` |
| `Label` | `Content`, `Target="#txt_depot"` | `#` 이름으로 입력란 연결. `Label.ts` |
| `ProgressBar` | `Minimum`, `Maximum`, `Value`, `IsIndeterminate` | `Range.ts` |
| `Slider` | `Minimum`, `Maximum`, `Value`, `TickFrequency`, `IsSnapToTickEnabled` | `Range.ts` |
| `NumericUpDown` | `Minimum`, `Maximum`, `Value` | 값 바인딩 예: `Value="{@revFrom}"`. `Range.ts` |
| `Image` | `Source`, `Stretch="Uniform"` | `Image.ts` |
| `Icon` | `Name="search"`, `Size="24"` | `Name`은 lucide 심볼명(`IconSprite.ts` 목록). 기본 크기는 테마 아이콘 크기 추종 |
| `Separator` | `Orientation="Horizontal"` | 구분선. `Separator.ts` |
| `ContentPresenter` | (셸·템플릿용) | 일반 화면에서는 쓸 일 없음 |

## 9. 목록·선택·메뉴 컨트롤 (Items)

소스: `Source/Scouter.Gui/Controls/Items/*.ts`. **선언형과 코드 주입을 구분**하는 게 핵심이다.

| 태그 | XML 선언 | 코드 주입 (MainControl에서) | 소스 |
|---|---|---|---|
| `ListBox` | `<ListBox Name="lst_demo" />` (자식 선언 불가. `SelectionMode="Extended"`) | `list.SetItems(["a","b"])`, `SelectionChanged` | `ListBox.ts` |
| `ComboBox` | `<ComboBox Name="cmb_demo" />` | `combo.SetItems([...])` | `ComboBox.ts` |
| `TabControl` + `TabItem` | `<TabControl Name="tabs"><TabItem Header="로그">...본문...</TabItem></TabControl>` — 직접 붙인 TabItem은 자동으로 스트립에 오른다 | `tabs.SelectedIndex = 1` | `TabControl.ts` |
| `ListView` | `<ListView Name="lst_files" SelectionMode="Extended" />` | `view.SetItems([{Rev:1,...}])`, 그리드 필요시 `view.View = grid` + `GridViewColumn` | `ListView.ts` |
| `DataGrid` | `<DataGrid Name="grid_demo" />` | `grid.SetItems([{Name:"a",Value:1}])` (첫 행 키로 자동 열) | `DataGrid.ts` |
| `TreeView` | `<TreeView Name="tree_demo" />` | `tree.SetItems(노드들, {HeaderOf, ChildrenOf, HasChildren})` 어댑터 필수 | `TreeView.ts` |
| `Menu` + `MenuItem` | `<Menu><MenuItem Header="파일"/><MenuItem Header="편집" InputGestureText="Ctrl+E"/></Menu>` (`IsCheckable`, `Command`도 가능) | `menu.AddItem(item)` (코드 생성 시) | `Menu.ts` |
| `ToolBar` | 자식으로 `Button` 가능 | `toolbar.UpdateOverflow()` | `ToolBar.ts` |
| `Expander` | `<Expander Header="펼치기" IsExpanded="true">본문 1개</Expander>` | `Expanded`/`Collapsed` 이벤트 | `Expander.ts` |
| `GroupBox` | `<GroupBox Header="그룹">...</GroupBox>` | — | `Expander.ts` |
| `ContextMenu` | XML 선언 불가. 코드로만: `new ContextMenu()` + `MenuItem` → `control.ContextMenu = menu` | P4Util `BindMenu`, ControlLab 참고 | `ContextMenu.ts` |
| `Popup` | 코드로만 (`PlacementTarget`, `IsOpen`, `StaysOpen`) | ComboBox·Menu 내부에서 사용 중 | `Popup.ts` |

선택 읽기: `SelectedIndex`/`SelectedItem`/`SelectedItems`, `SelectionChanged` 이벤트. `Selector.ts` 참고.

## 10. Scouter 전용 컨트롤

소스: `Source/Scouter.Gui/Controls/Scouter/*.ts`.

| 태그 | 주요 속성·코드 | 소스 |
|---|---|---|
| `VirtualList` | `<VirtualList Name="v" />` + `v.ItemTemplate = (i) => row; v.Count = n`. `ItemHeight` 생략 시 폰트 연동 자동 높이 | `VirtualList.ts` |
| `LogView` | `MaxLines`, `AutoScroll`, `Filter`, `LevelFilter` + `view.Append({Ts, Level, Scope, Msg})`, `CopyAll()`, `Clear()` | `LogView.ts` |
| `Badge` | `Text`, `Variant="Info/Success/Warn/Error"` | `Badge.ts` |
| `Avatar` | `Text="홍 길동"`, `Size="32"`, `Source` | `Avatar.ts` |
| `StatusDot` | `Status="Idle/Ok/Warn/Error/Busy"` | `StatusDot.ts` |
| `Spinner` | `Size="20"` | `Spinner.ts` |
| `CodeEditor` | `Language="typescript"`, `Text`, `ReadOnly` + `TextChanged`, `RevealLine(n)`, `SetMarkers([...])`. 폰트는 테마 추종 | `CodeEditor.ts` |
| `DiffView` | `Language`, `Original`, `Modified`, `SideBySide` | `DiffView.ts` |
| `MarkdownView` | 코드에서 `md.Source = "# 제목"` + `LinkRequested` 이벤트 | `MarkdownView.ts` |
| `PropertyGrid` | 코드에서 `grid.SetSchema(스키마, 값)` + `grid.Get()` | `PropertyGrid.ts` |
| `StatusBar` + `StatusBarItem` | `<StatusBar><StatusBarItem>...</StatusBarItem></StatusBar>` (DockPanel 상속. 오른쪽 정렬은 `DockPanel.Dock="Right"`) | `StatusBar.ts` |
| `TitleBar` | 셸 전용. 일반 화면에서 사용 금지 | `TitleBar.ts` |

## 11. 린트 코드표

`npm run lint:layout` 실행. 에러(E*)가 1개라도 있으면 exit 1.

| 코드 | 의미 | 대처 |
|---|---|---|
| E001 | 루트가 Window/UserControl 아님 | 루트 수정 |
| E003 | 자식 추가 실패 | 부모-자식 조합 확인 (예: Decorator에 2개) |
| E010/E011/E012 | 미등록 태그/속성/붙임 | 오타 또는 해당 컨트롤 소스에서 속성명 확인 |
| E020/E021 | 타입·값 변환 실패 | `Minimum="abc"` 같은 것 수정 |
| E022 | 미선언 참조(`{@없는키}`, `#없는이름`) | Data 키·Name 확인 |
| E023/E024 | 식 오류·함수 오류 | 바인딩 식 괄호·백틱 확인 |
| E030 | Name 중복 | 이름 변경 |
| W040 | Name이 snake_case 아님 | 이름 변경 권장 |
| W041 | 상호작용 컨트롤에 Name 없음 | Name 추가 (E2E·코드에 필요) |
| W050/W051 | 핸들러·Command 미등록 | 코드·명령 등록 확인 |
| W060 | 리터럴 색(`#fff`) | `{$theme...}` 토큰 사용 |

## 12. 한 줄 요약

태그는 `ScouterCore__ControlCatalog`에서 찾고, 목록은 코드(`SetItems`)로 채우고, 속성이 안 먹으면 해당 컨트롤의 `*.ts`를 여는 것 — 이 세 문장이 이 문서 전체다.
