/*
	작성자: 윤정도
	생성일: 2026-09-13
	=====
	설명: 내장 데스크톱 테마 묶음. 37종 정적 포함.
*/

import type { IRawDesktopThemeJson } from "@scouter/gui";
import desktop0 from "./Desktop/amoled.json" with { type: "json" };
import desktop1 from "./Desktop/aura.json" with { type: "json" };
import desktop2 from "./Desktop/ayu.json" with { type: "json" };
import desktop3 from "./Desktop/carbonfox.json" with { type: "json" };
import desktop4 from "./Desktop/catppuccin.json" with { type: "json" };
import desktop5 from "./Desktop/catppuccin-frappe.json" with { type: "json" };
import desktop6 from "./Desktop/catppuccin-macchiato.json" with { type: "json" };
import desktop7 from "./Desktop/cobalt2.json" with { type: "json" };
import desktop8 from "./Desktop/cursor.json" with { type: "json" };
import desktop9 from "./Desktop/dracula.json" with { type: "json" };
import desktop10 from "./Desktop/everforest.json" with { type: "json" };
import desktop11 from "./Desktop/flexoki.json" with { type: "json" };
import desktop12 from "./Desktop/github.json" with { type: "json" };
import desktop13 from "./Desktop/gruvbox.json" with { type: "json" };
import desktop14 from "./Desktop/kanagawa.json" with { type: "json" };
import desktop15 from "./Desktop/lucent-orng.json" with { type: "json" };
import desktop16 from "./Desktop/material.json" with { type: "json" };
import desktop17 from "./Desktop/matrix.json" with { type: "json" };
import desktop18 from "./Desktop/mercury.json" with { type: "json" };
import desktop19 from "./Desktop/monokai.json" with { type: "json" };
import desktop20 from "./Desktop/nightowl.json" with { type: "json" };
import desktop21 from "./Desktop/nord.json" with { type: "json" };
import desktop22 from "./Desktop/oc-2.json" with { type: "json" };
import desktop23 from "./Desktop/one-dark.json" with { type: "json" };
import desktop24 from "./Desktop/onedarkpro.json" with { type: "json" };
import desktop25 from "./Desktop/opencode.json" with { type: "json" };
import desktop26 from "./Desktop/orng.json" with { type: "json" };
import desktop27 from "./Desktop/osaka-jade.json" with { type: "json" };
import desktop28 from "./Desktop/palenight.json" with { type: "json" };
import desktop29 from "./Desktop/rosepine.json" with { type: "json" };
import desktop30 from "./Desktop/shadesofpurple.json" with { type: "json" };
import desktop31 from "./Desktop/solarized.json" with { type: "json" };
import desktop32 from "./Desktop/synthwave84.json" with { type: "json" };
import desktop33 from "./Desktop/tokyonight.json" with { type: "json" };
import desktop34 from "./Desktop/vercel.json" with { type: "json" };
import desktop35 from "./Desktop/vesper.json" with { type: "json" };
import desktop36 from "./Desktop/zenburn.json" with { type: "json" };

export interface IDesktopBundleEntry
{
	Id: string;
	Json: IRawDesktopThemeJson;
}

export const kDesktopThemes: IDesktopBundleEntry[] = [
	{ Id: "amoled", Json: desktop0 },
	{ Id: "aura", Json: desktop1 },
	{ Id: "ayu", Json: desktop2 },
	{ Id: "carbonfox", Json: desktop3 },
	{ Id: "catppuccin", Json: desktop4 },
	{ Id: "catppuccin-frappe", Json: desktop5 },
	{ Id: "catppuccin-macchiato", Json: desktop6 },
	{ Id: "cobalt2", Json: desktop7 },
	{ Id: "cursor", Json: desktop8 },
	{ Id: "dracula", Json: desktop9 },
	{ Id: "everforest", Json: desktop10 },
	{ Id: "flexoki", Json: desktop11 },
	{ Id: "github", Json: desktop12 },
	{ Id: "gruvbox", Json: desktop13 },
	{ Id: "kanagawa", Json: desktop14 },
	{ Id: "lucent-orng", Json: desktop15 },
	{ Id: "material", Json: desktop16 },
	{ Id: "matrix", Json: desktop17 },
	{ Id: "mercury", Json: desktop18 },
	{ Id: "monokai", Json: desktop19 },
	{ Id: "nightowl", Json: desktop20 },
	{ Id: "nord", Json: desktop21 },
	{ Id: "oc-2", Json: desktop22 },
	{ Id: "one-dark", Json: desktop23 },
	{ Id: "onedarkpro", Json: desktop24 },
	{ Id: "opencode", Json: desktop25 },
	{ Id: "orng", Json: desktop26 },
	{ Id: "osaka-jade", Json: desktop27 },
	{ Id: "palenight", Json: desktop28 },
	{ Id: "rosepine", Json: desktop29 },
	{ Id: "shadesofpurple", Json: desktop30 },
	{ Id: "solarized", Json: desktop31 },
	{ Id: "synthwave84", Json: desktop32 },
	{ Id: "tokyonight", Json: desktop33 },
	{ Id: "vercel", Json: desktop34 },
	{ Id: "vesper", Json: desktop35 },
	{ Id: "zenburn", Json: desktop36 },
];
