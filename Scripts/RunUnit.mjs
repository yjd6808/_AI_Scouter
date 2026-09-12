import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const kRoots = ["Source/Scouter.Tests/Unit", "Source/Scouter.Tests/Integration"];

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
	Collect(root, files);
if (files.length === 0)
{
	console.log("no test files");
	process.exit(0);
}
const args = ["--import", "tsx", "--import", "./Source/Scouter.Tests/Setup.ts", "--test", "--test-reporter", "spec"];
if (process.env.COV === "1")
	args.push("--experimental-test-coverage");
args.push(...files);
const result = spawnSync(process.execPath, args, { stdio: "inherit" });
process.exit(result.status ?? 1);
