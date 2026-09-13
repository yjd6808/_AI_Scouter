/*
	작성자: 윤정도
	생성일: 2026-09-13
	=====
	설명: globalToast 페이지. Main 푸시를 앱 Toast와 같은 모양으로 쌓는다.
*/

import "../../../Scouter.Gui/Styles/Layers.css";

interface INotifyRenderer
{
	on(_channel: string, _listener: (..._args: unknown[]) => void): void;
	send(_channel: string, ..._args: unknown[]): void;
}

interface INotifyPayload
{
	Id: number;
	Title: string;
	Message?: string;
	Variant: string;
	DurationMs: number;
	ThemeCss: string;
}

const kMax = 5;
const kKinds = ["info", "success", "warn", "error"];

// eslint-disable-next-line @typescript-eslint/no-require-imports -- electron-renderer 직접 접근은 이 파일만
const ipc: INotifyRenderer = (require("electron") as { ipcRenderer: INotifyRenderer }).ipcRenderer;

const timers = new Map<number, ReturnType<typeof setTimeout>>();

////////////////////////////////////////////////////////////////////////////////////////
// 목록 루트를 구한다.
function List(): HTMLElement | null
{
	return document.getElementById("global-toasts");
}

////////////////////////////////////////////////////////////////////////////////////////
// 종류명을 굳힌다. 모르면 info.
function KindOf(_raw: unknown): string
{
	return typeof _raw === "string" && kKinds.includes(_raw.toLowerCase()) ? _raw.toLowerCase() : "info";
}

////////////////////////////////////////////////////////////////////////////////////////
// 내용 높이를 Main에 알린다. 비면 숨김 요청.
function Report(): void
{
	const list = List();
	if (list === null)
		return;
	if (list.children.length === 0)
	{
		ipc.send("notify:empty");
		return;
	}
	requestAnimationFrame(() =>
	{
		const target = List();
		if (target !== null)
			ipc.send("notify:height", target.scrollHeight);
	});
}

////////////////////////////////////////////////////////////////////////////////////////
// 토스트 1개를 지운다.
function Dismiss(_id: number): void
{
	const timer = timers.get(_id);
	if (timer !== undefined)
	{
		clearTimeout(timer);
		timers.delete(_id);
	}
	List()?.querySelector(`[data-toast-id="${_id}"]`)?.remove();
	Report();
}

////////////////////////////////////////////////////////////////////////////////////////
// 푸시를 쌓는다. 앱 Toast와 같은 DOM·클래스.
function Push(_payload: unknown): void
{
	const list = List();
	const data = _payload as Partial<INotifyPayload>;
	if (list === null || typeof data.Title !== "string")
		return;
	const theme = document.getElementById("notify-theme");
	if (theme !== null && typeof data.ThemeCss === "string")
		theme.textContent = data.ThemeCss;
	while (list.children.length >= kMax)
	{
		const oldest = list.firstElementChild;
		const id = Number(oldest?.getAttribute("data-toast-id") ?? "0");
		if (oldest !== null)
		{
			const timer = timers.get(id);
			if (timer !== undefined)
			{
				clearTimeout(timer);
				timers.delete(id);
			}
			oldest.remove();
		}
		else
			break;
	}
	const id = typeof data.Id === "number" ? data.Id : Date.now();
	const toast = document.createElement("div");
	toast.className = `gui-toast variant-${KindOf(data.Variant)}`;
	toast.setAttribute("data-toast-id", String(id));
	const title = document.createElement("div");
	title.className = "gui-toast__title";
	title.textContent = data.Title;
	toast.append(title);
	if (typeof data.Message === "string" && data.Message.length > 0)
	{
		const msg = document.createElement("div");
		msg.textContent = data.Message;
		toast.append(msg);
	}
	toast.addEventListener("click", () =>
	{
		ipc.send("notify:click", { Id: id });
		Dismiss(id);
	});
	list.append(toast);
	if (typeof data.DurationMs === "number" && data.DurationMs > 0)
	{
		timers.set(id, setTimeout(() =>
		{
			Dismiss(id);
		}, data.DurationMs));
	}
	Report();
}

ipc.on("notify:push", (_e, _payload) =>
{
	Push(_payload);
});
ipc.send("notify:ready");
