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
const result = spawnSync(process.execPath,
	["--import", "tsx", "--test", "--test-reporter", "spec", ...files],
	{ stdio: "inherit" });
process.exit(result.status ?? 1);
