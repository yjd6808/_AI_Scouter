import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const kRoots = ["Source/Scouter.Tests/E2E"];

function Collect(_dir, _out)
{
	for (const entry of readdirSync(_dir))
	{
		const full = join(_dir, entry);
		if (statSync(full).isDirectory())
			Collect(full, _out);
		else if (entry.endsWith(".test.ts"))
			_out.push(full);
	}
}

const files = [];
for (const root of kRoots)
{
	try
	{
		Collect(root, files);
	}
	catch
	{
		// 폴더 없음.
	}
}
if (files.length === 0)
{
	console.log("no e2e files");
	process.exit(0);
}
// 파일마다 별도 프로세스로 차례로 돌린다. 포트·세션 간섭 방지.
let failed = false;
for (const file of files)
{
	const result = spawnSync(process.execPath,
		["--import", "tsx", "--test", "--test-reporter", "spec", file],
		{ stdio: "inherit" });
	if ((result.status ?? 1) !== 0)
		failed = true;
}
process.exit(failed ? 1 : 0);
