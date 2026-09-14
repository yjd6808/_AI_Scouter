/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: PluginManager. 발견→검증→권한→번들→import→활성화.
*/

import * as path from "node:path";
import { promises as fs } from "node:fs";
import { SimpleEvent } from "@scouter/gui";
import { UIManager, UserControl, TextBlock, BindingGraph, XmlLoader, WindowRegistry, UIElement } from "@scouter/gui";
import type { Window } from "@scouter/gui";
import type { IPluginManifest, PluginBase } from "@scouter/plugin-api";
import { Settings } from "../Services/Settings";
import { Paths } from "../Services/Paths";
import { Args } from "../Services/Args";
import { Log } from "../Services/Log";
import { PluginDiscovery } from "./PluginDiscovery";
import type { IPluginCandidate } from "./PluginDiscovery";
import { ManifestValidator } from "./ManifestValidator";
import { PluginBundler } from "./PluginBundler";
import { PermissionStore } from "./PermissionStore";
import { PluginContext } from "./PluginContext";
import type { IPluginHost } from "./PluginContext";
import { ToolRegistry } from "./ToolRegistry";
import { ApiShim } from "./ApiShim";
import { TestApiServer } from "../TestApi/TestApiServer";

export type PluginState = "Loading" | "Active" | "Error" | "Disabled";
export type PluginSource = "BuiltIn" | "User" | "External";
export type PluginNotice = "Dirty" | "Error";

export interface IPluginHandle
{
	Manifest: IPluginManifest;
	Dir: string;
	Source: PluginSource;
	State: PluginState;
	Instance: PluginBase | null;
	Context: PluginContext | null;
	LayoutXml: string | null;
	Error?: string;
	LoadMs: number;
}

export interface IPluginInfo
{
	Id: string;
	Name: string;
	Version: string;
	State: PluginState;
	Source: PluginSource;
	Tools: string[];
	LoadMs: number;
}

class ManagerHost implements IPluginHost
{
	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 저장 폴더를 구한다.
	// @param _id: Plugin Id
	public StorageDir(_id: string): string
	{
		return path.join(Paths.ScouterHome, "plugins", _id);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 권한 보유 여부를 본다.
	// @param _id: Plugin Id
	// @param _perm: 권한
	public HasPermission(_id: string, _perm: string): boolean
	{
		return PluginManager.GrantedSync(_id).includes(_perm);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 목록을 반환한다.
	public AppPlugins(): Array<{ Id: string; Name: string; Version: string; State: string }>
	{
		return PluginManager.List().map((_p) => ({ Id: _p.Id, Name: _p.Name, Version: _p.Version, State: _p.State }));
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 앱 버전을 반환한다.
	public AppVersion(): string
	{
		return Paths.Version;
	}
}

export class PluginManager
{
	// ==================== 정적 ====================
	private static readonly s_plugins_ = new Map<string, IPluginHandle>();
	private static readonly s_changed_ = new SimpleEvent<void>();
	private static s_permStore_: PermissionStore | null = null;
	private static readonly s_granted_ = new Map<string, string[]>();
	private static s_permQueue_: Promise<void> = Promise.resolve();
	private static readonly s_viewGraphs_ = new Map<UserControl, BindingGraph>();
	private static s_dirs_: Array<{ Dir: string | null; Source: "BuiltIn" | "User" | "External" }> = [];
	private static readonly s_notices_ = new Map<string, PluginNotice>();

	// ==================== 속성 ====================
	public static get Changed(): SimpleEvent<void> { return PluginManager.s_changed_; }

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 전부 로드한다. 실패 Plugin은 격리하고 계속.
	// @param _builtIn: 내장 폴더 (없으면 null)
	public static async LoadAllAsync(_builtIn: string | null = null): Promise<void>
	{
		const userDir = path.join(Paths.ScouterHome, "plugins");
		PluginManager.s_dirs_ = [
			{ Dir: Args.Safe ? null : _builtIn, Source: "BuiltIn" },
			{ Dir: Args.Safe ? null : userDir, Source: "User" },
			{ Dir: Args.Safe ? null : (Args.PluginDir ?? (Paths.IsPackaged ? Paths.ExePluginDir : "Plugins")), Source: "External" },
		];
		PluginManager.s_permStore_ = new PermissionStore(path.join(Paths.ScouterHome, "permissions.json"));
		const candidates = await PluginDiscovery.Scan(PluginManager.s_dirs_);
		await Promise.allSettled(candidates.map((_c) => PluginManager.LoadCandidate(_c)));
		PluginManager.SortById();
		PluginManager.s_changed_.Invoke(undefined);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 폴더 1개를 로드한다.
	// @param _dir: Plugin 폴더
	// @param _source: 출처
	public static async LoadAsync(_dir: string, _source: PluginSource): Promise<IPluginHandle>
	{
		return PluginManager.LoadCandidate({ Id: path.basename(_dir), Dir: _dir, Source: _source });
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 언로드한다. 등록·구독 전부 해제.
	// @param _id: Plugin Id
	public static async UnloadAsync(_id: string): Promise<void>
	{
		const handle = PluginManager.s_plugins_.get(_id);
		if (handle === undefined)
			return;
		if (handle.Instance !== null)
		{
			try
			{
				await handle.Instance.Deactivate();
			}
			catch
			{
				// 무시.
			}
		}
		handle.Context?.Dispose();
		for (const [view, graph] of [...PluginManager.s_viewGraphs_])
		{
			if (view.PluginId === _id)
			{
				graph.Clear(view);
				PluginManager.s_viewGraphs_.delete(view);
			}
		}
		handle.Instance = null;
		handle.Context = null;
		handle.State = "Disabled";
		PluginManager.s_changed_.Invoke(undefined);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 다시 읽는다. 실패하면 Error 상태 + 이전 제거.
	// @param _id: Plugin Id
	public static async ReloadAsync(_id: string): Promise<void>
	{
		const handle = PluginManager.s_plugins_.get(_id);
		if (handle === undefined)
			return;
		const dir = handle.Dir;
		const source = handle.Source;
		await PluginManager.UnloadAsync(_id);
		PluginManager.s_plugins_.delete(_id);
		try
		{
			await PluginManager.LoadCandidate({ Id: _id, Dir: dir, Source: source });
		}
		catch (_e)
		{
			Log.Error("Plugin", `리로드 실패: ${_id}`, { error: String(_e) });
		}
		const fresh = PluginManager.s_plugins_.get(_id);
		if (fresh !== undefined && fresh.State === "Active")
			PluginManager.ClearNotice(_id);
		else
			PluginManager.SetNotice(_id, "Error");
		PluginManager.s_changed_.Invoke(undefined);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 목록을 반환한다.
	public static List(): IPluginInfo[]
	{
		return [...PluginManager.s_plugins_.values()].map((_h) => ({
			Id: _h.Manifest.Id, Name: _h.Manifest.Name, Version: _h.Manifest.Version,
			State: _h.State, Source: _h.Source, Tools: _h.Manifest.Tools, LoadMs: _h.LoadMs,
		}));
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 보유 여부를 본다.
	// @param _id: Plugin Id
	public static Has(_id: string): boolean
	{
		return PluginManager.s_plugins_.has(_id);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 핸들을 구한다.
	// @param _id: Plugin Id
	public static Get(_id: string): IPluginHandle | null
	{
		return PluginManager.s_plugins_.get(_id) ?? null;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 변경·오류 표시를 구한다. 없으면 null.
	// @param _id: Plugin Id
	public static NoticeOf(_id: string): PluginNotice | null
	{
		return PluginManager.s_notices_.get(_id) ?? null;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 다시 로드 필요 표시를 단다. 오류 표시는 Dirty로 바뀐다.
	// @param _id: Plugin Id
	public static MarkDirty(_id: string): void
	{
		PluginManager.SetNotice(_id, "Dirty");
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 표시를 지운다. 없으면 조용히 넘긴다.
	// @param _id: Plugin Id
	public static ClearNotice(_id: string): void
	{
		if (!PluginManager.s_notices_.has(_id))
			return;
		PluginManager.s_notices_.delete(_id);
		PluginManager.s_changed_.Invoke(undefined);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 메인 뷰를 만든다. 레이아웃 먼저, OnInit 나중. 실패면 오류 뷰.
	// @param _id: Plugin Id
	public static CreateMainView(_id: string): UserControl
	{
		const handle = PluginManager.s_plugins_.get(_id);
		if (handle === undefined || handle.State !== "Active" || handle.Context === null)
			return PluginManager.ErrorView(`${_id} 비활성`);
		try
		{
			const ctor = WindowRegistry.Resolve(`${_id}/Main`);
			if (ctor === null)
				throw new Error(`[Plugin] 메인 화면 미등록: ${_id}/Main`);
			const created: UIElement = new ctor();
			if (!(created instanceof UserControl))
				throw new Error(`[Plugin] UserControl 아님: ${_id}/Main`);
			created.PluginId = _id;
			if (handle.LayoutXml !== null)
			{
				const graph = new BindingGraph();
				PluginManager.s_viewGraphs_.set(created, graph);
				const ctx = UIManager.CreateContext();
				ctx.Graph = graph;
				const result = XmlLoader.LoadWindowInto(created, handle.LayoutXml, ctx);
				if (!result.Ok)
					throw new Error(`[Plugin] 뷰 로드 실패: ${_id}: ${result.Errors[0]?.Text ?? ""}`);
			}
			created.AttachToManager(UIManager.Active as Window, created.DataList);
			return created;
		}
		catch (_e)
		{
			return PluginManager.ErrorView(String(_e));
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 동기 권한 조회. Context 가드용.
	// @param _id: Plugin Id
	public static GrantedSync(_id: string): string[]
	{
		return PluginManager.s_granted_.get(_id) ?? [];
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 표시를 쓴다. 같으면 조용히 넘긴다. 사이드바가 Changed로 다시 그린다.
	// @param _id: Plugin Id
	// @param _notice: 표시
	private static SetNotice(_id: string, _notice: PluginNotice): void
	{
		if (PluginManager.s_notices_.get(_id) === _notice)
			return;
		PluginManager.s_notices_.set(_id, _notice);
		PluginManager.s_changed_.Invoke(undefined);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 병렬 로드 완료 순서를 Id 알파벳순으로 굳힌다. 리로드 꼼수(맨 아래로 밀림) 방지.
	private static SortById(): void
	{
		const collator = new Intl.Collator("ko");
		const sorted = [...PluginManager.s_plugins_.entries()].sort((_a, _b) => collator.compare(_a[0], _b[0]));
		PluginManager.s_plugins_.clear();
		for (const [id, handle] of sorted)
			PluginManager.s_plugins_.set(id, handle);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 내장 Plugin 코드를 직접 import한다. 번들하면 싱글톤이 복제되므로 금지.
	// @param _id: Plugin Id
	private static async LoadBuiltIn(_id: string): Promise<{ default?: new () => PluginBase }>
	{
		switch (_id)
		{
			case "ScouterCore": return import("../BuiltIn/ScouterCore/Index");
			case "McpInspector": return import("../BuiltIn/McpInspector/Index");
			case "CommandPalette": return import("../BuiltIn/CommandPalette/Index");
			default: throw new Error(`[Plugin] 내장 로더 없음: ${_id}`);
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 외부 Plugin을 esbuild로 묶어 require한다.
	// @param _dir: Plugin 폴더
	// @param _manifest: 매니페스트
	private static async LoadBundled(_dir: string, _manifest: IPluginManifest): Promise<{ default?: new () => PluginBase }>
	{
		const outFile = await PluginBundler.BuildAsync(_dir, _manifest);
		const code = await fs.readFile(outFile, "utf-8");
		const rewritten = ApiShim.Rewrite(code);
		const loadFile = outFile.replace(/Index\.cjs$/, "Index.load.cjs");
		await fs.writeFile(loadFile, rewritten, "utf-8");
		try
		{
			const absolute = path.resolve(loadFile);
			Reflect.deleteProperty(__non_webpack_require__.cache, __non_webpack_require__.resolve(absolute));
			return __non_webpack_require__(absolute) as { default?: new () => PluginBase };
		}
		catch (_loadError)
		{
			throw new Error(`[Plugin] import 실패: ${loadFile}: ${String(_loadError)}`);
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 후보 1개를 끝까지 로드한다.
	// @param _candidate: 후보
	private static async LoadCandidate(_candidate: IPluginCandidate): Promise<IPluginHandle>
	{
		const started = Date.now();
		const raw = JSON.parse(await fs.readFile(path.join(_candidate.Dir, "Plugin.json"), "utf-8")) as unknown;
		const manifest = ManifestValidator.Validate(raw);
		if (manifest.Id !== _candidate.Id)
			Log.Warn("Plugin", `폴더명·Id 불일치: ${_candidate.Id} vs ${manifest.Id}`);
		if (!PluginManager.CheckVersion(manifest.MinAppVersion))
			throw new Error(`[Plugin] 앱 버전 미달: ${manifest.Id} >= ${manifest.MinAppVersion}`);
		const handle: IPluginHandle = { Manifest: manifest, Dir: _candidate.Dir, Source: _candidate.Source, State: "Loading", Instance: null, Context: null, LayoutXml: null, LoadMs: 0 };
		PluginManager.s_plugins_.set(manifest.Id, handle);
		try
		{
			await PluginManager.EnsurePermissions(manifest);
			let mod: { default?: new () => PluginBase };
			if (_candidate.Source === "BuiltIn")
				mod = await PluginManager.LoadBuiltIn(manifest.Id);
			else
				mod = await PluginManager.LoadBundled(_candidate.Dir, manifest);
			if (mod.default === undefined || typeof mod.default !== "function")
				throw new Error(`[Plugin] default export 없음: ${manifest.Id}`);
			const host = new ManagerHost();
			const ctx = new PluginContext(manifest, host);
			ctx.InitPaths(_candidate.Dir, host.StorageDir(manifest.Id), Paths.ScouterHome, Paths.Temp, Paths.Version);
			const instance = new mod.default();
			handle.Instance = instance;
			handle.Context = ctx;
			await Promise.race([
				instance.Activate(ctx),
				new Promise((_resolve, _reject) =>
				{
					setTimeout(() =>
					{
						_reject(new Error("Activate 타임아웃"));
					}, 10000);
				}),
			]);
			PluginManager.CheckDeclarations(manifest);
			try
			{
				handle.LayoutXml = await fs.readFile(path.join(_candidate.Dir, manifest.Layout), "utf-8");
			}
			catch
			{
				handle.LayoutXml = null;
			}
			if (manifest.Settings !== undefined)
				Settings.RegisterSchema(`Plugins.${manifest.Id}`, JSON.parse(await fs.readFile(path.join(_candidate.Dir, manifest.Settings), "utf-8")) as Record<string, unknown>);
			handle.State = "Active";
			handle.LoadMs = Date.now() - started;
			Log.Info("Plugin", `${manifest.Id} 로드 ${handle.LoadMs}ms`);
		}
		catch (_e)
		{
			handle.State = "Error";
			handle.Error = String(_e);
			handle.LoadMs = Date.now() - started;
			Log.Error("Plugin", `${manifest.Id} 실패`, { error: String(_e) });
			PluginManager.SetNotice(manifest.Id, "Error");
		}
		return handle;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 권한을 확보한다. App.AskPluginPermission이 켜져 있을 때만 다이얼로그(순차). --test는 자동 승인.
	// @param _manifest: 매니페스트
	private static async EnsurePermissions(_manifest: IPluginManifest): Promise<void>
	{
		const required = _manifest.Permissions;
		if (required.length === 0)
		{
			PluginManager.s_granted_.set(_manifest.Id, []);
			return;
		}
		const store = PluginManager.s_permStore_;
		const granted = store !== null ? await store.Granted(_manifest.Id) : [];
		const missing = required.filter((_p) => !granted.includes(_p));
		if (missing.length === 0)
		{
			PluginManager.s_granted_.set(_manifest.Id, granted);
			return;
		}
		let allow = false;
		if (Args.IsTest)
		{
			allow = TestApiServer.PermissionDecision(_manifest.Id) ?? true;
		}
		else if (!Settings.Get<boolean>("App.AskPluginPermission", false))
		{
			allow = true;	// 로컬 신뢰 환경이므로 선언 권한을 자동 승인한다(D-11). 설정을 켜면 다시 묻는다.
		}
		else
		{
			const previous = PluginManager.s_permQueue_;
			let release: () => void = () => undefined;
			PluginManager.s_permQueue_ = previous.then(() => new Promise<void>((_resolve) => { release = _resolve; }));
			await previous;
			try
			{
				allow = await PluginManager.AskPermissions(_manifest, missing);
			}
			finally
			{
				release();
			}
		}
		if (!allow)
		{
			PluginManager.s_granted_.set(_manifest.Id, granted);
			throw new Error(`[Plugin] 권한 거부: ${_manifest.Id}`);
		}
		const merged = [...new Set([...granted, ...missing])];
		PluginManager.s_granted_.set(_manifest.Id, merged);
		if (store !== null)
			await store.GrantAsync(_manifest.Id, merged, _manifest.Version);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 권한 다이얼로그를 띄운다.
	// @param _manifest: 매니페스트
	// @param _missing: 부족 권한
	private static async AskPermissions(_manifest: IPluginManifest, _missing: string[]): Promise<boolean>
	{
		try
		{
			const result = await UIManager.ShowDialogAsync<boolean>("PermissionDialog", {
				pluginName: `${_manifest.Name} ${_manifest.Version}`,
				permText: _missing.join(", "),
			});
			return result;
		}
		catch
		{
			return false;
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// Tools/Commands 선언·등록 대조. 어긋나면 경고.
	// @param _manifest: 매니페스트
	private static CheckDeclarations(_manifest: IPluginManifest): void
	{
		const registered = new Set(ToolRegistry.List().filter((_t) => _t.PluginId === _manifest.Id).map((_t) => _t.Tool.Name));
		for (const declared of _manifest.Tools)
		{
			if (!registered.has(declared))
				Log.Warn("Plugin", `W-P01 선언만 됨: ${_manifest.Id}.${declared}`);
		}
		for (const name of registered)
		{
			if (!_manifest.Tools.includes(name))
				Log.Error("Plugin", `미선언 등록: ${_manifest.Id}.${name}`);
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 최소 앱 버전을 비교한다. x.y.z만.
	// @param _min: 최소 버전
	private static CheckVersion(_min: string): boolean
	{
		const parse = (_v: string): number[] => _v.split(".").map((_n) => Number(_n) || 0);
		const app = parse(Paths.Version);
		const min = parse(_min);
		for (let idx = 0; idx < 3; ++idx)
		{
			const a = app[idx] ?? 0;
			const b = min[idx] ?? 0;
			if (a !== b)
				return a > b;
		}
		return true;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 오류 뷰를 만든다. 메시지를 그대로 보여준다.
	// @param _message: 메시지
	private static ErrorView(_message: string): UserControl
	{
		const view = new UserControl();
		const text = new TextBlock();
		text.Text = _message;
		view.Content = text;
		return view;
	}
}

export type { IPluginCandidate };
