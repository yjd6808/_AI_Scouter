/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: 하네스 CLI P0판. tree/shot 중 tree만 동작한다.
*/

import { Harness } from "./Harness";

//////////////////////////////////////////////////////////////////////////////////////////
// CLI 진입점.
async function Main(): Promise<void>
{
	const cmd = process.argv[2] ?? "tree";
	const port = Number(process.env["SCOUTER_PORT"] ?? 9515);
	const app = new Harness(port);
	await app.WaitReady();
	if (cmd === "tree")
	{
		console.log(JSON.stringify(await app.Tree(), null, 2));
	}
	await app.Quit();
}
void Main();
