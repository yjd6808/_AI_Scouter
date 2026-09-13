/*
	작성자: 윤정도
	생성일: 2026-09-13
	=====
	설명: messageBox 페이지. Main 표시를 자체 확인창으로 띄우고 결과를 돌려준다.
*/

interface IMessageRenderer
{
	on(_channel: string, _listener: (..._args: unknown[]) => void): void;
	send(_channel: string, ..._args: unknown[]): void;
}

interface IMessagePayload
{
	Id: number;
	Title: string;
	Message?: string;
	Kind: string;
	DurationMs: number;
	ThemeCss: string;
}

const kResults = ["ok", "yes", "no", "timeout", "closed"];

// eslint-disable-next-line @typescript-eslint/no-require-imports -- electron-renderer 직접 접근은 이 파일만
const ipc: IMessageRenderer = (require("electron") as { ipcRenderer: IMessageRenderer }).ipcRenderer;

let timer: ReturnType<typeof setTimeout> | null = null;
let answered = false;

//////////////////////////////////////////////////////////////////////////////////////
// 카드 루트를 구한다.
function Card(): HTMLElement | null
{
	return document.getElementById("message-card");
}

//////////////////////////////////////////////////////////////////////////////////////
// 내용 높이를 Main에 알린다.
function ReportHeight(): void
{
	requestAnimationFrame(() =>
	{
		const wrap = document.getElementById("message-wrap");
		if (wrap !== null)
			ipc.send("message:height", wrap.scrollHeight);
	});
}

//////////////////////////////////////////////////////////////////////////////////////
// 결과를 1회만 Main에 돌려준다. 타이머도 걷는다.
function Answer(_result: string): void
{
	if (answered)
		return;
	answered = true;
	if (timer !== null)
	{
		clearTimeout(timer);
		timer = null;
	}
	const card = Card();
	if (card !== null)
		card.hidden = true;
	ipc.send("message:result", kResults.includes(_result) ? _result : "closed");
}

//////////////////////////////////////////////////////////////////////////////////////
// 버튼을 만든다. 기본 버튼에 포커스.
// @param _box: 버튼 상자
// @param _label: 표시 글자
// @param _result: 결과명
// @param _primary: 강조 여부
function AddButton(_box: HTMLElement, _label: string, _result: string, _primary: boolean): void
{
	const btn = document.createElement("button");
	btn.type = "button";
	btn.textContent = _label;
	if (_primary)
		btn.classList.add("primary");
	btn.addEventListener("click", () =>
	{
		Answer(_result);
	});
	_box.append(btn);
	if (_primary)
		btn.focus();
}

//////////////////////////////////////////////////////////////////////////////////////
// 표시를 그린다. 지속이 있으면 타임아웃을 건다.
// @param _payload: 표시 묶음
function Show(_payload: unknown): void
{
	const data = _payload as Partial<IMessagePayload>;
	if (typeof data.Title !== "string")
		return;
	answered = false;
	if (timer !== null)
	{
		clearTimeout(timer);
		timer = null;
	}
	const theme = document.getElementById("message-theme");
	if (theme !== null && typeof data.ThemeCss === "string")
		theme.textContent = data.ThemeCss;
	const card = Card();
	const title = document.getElementById("message-title");
	const text = document.getElementById("message-text");
	const box = document.getElementById("message-buttons");
	if (card === null || title === null || text === null || box === null)
		return;
	title.textContent = data.Title;
	text.textContent = typeof data.Message === "string" ? data.Message : "";
	text.style.display = typeof data.Message === "string" && data.Message.length > 0 ? "" : "none";
	box.replaceChildren();
	if (data.Kind === "yesno")
	{
		AddButton(box, "아니요", "no", false);
		AddButton(box, "예", "yes", true);
	}
	else
		AddButton(box, "확인", "ok", true);
	card.hidden = false;
	if (typeof data.DurationMs === "number" && data.DurationMs > 0)
	{
		timer = setTimeout(() =>
		{
			Answer("timeout");
		}, data.DurationMs);
	}
	ReportHeight();
}

document.addEventListener("keydown", (_e) =>
{
	if (_e.key === "Escape")
		Answer("closed");
});

ipc.on("message:push", (_e, _payload) =>
{
	Show(_payload);
});
ipc.send("message:ready");
