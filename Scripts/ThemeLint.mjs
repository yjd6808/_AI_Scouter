import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { ThemeLint } from "../Source/Scouter.Gui/Index.ts";

const roots = process.argv.slice(2);
let failed = false;

function Collect(_dir, _out)
{
	for (const entry of readdirSync(_dir))
	{
		const full = join(_dir, entry);
		if (statSync(full).isDirectory())
		{
			Collect(full, _out);
			continue;
		}
		if (entry.endsWith(".json"))
			_out.push(full);
	}
}

const files = [];
for (const root of roots)
	Collect(root, files);

for (const file of files)
{
	const json = JSON.parse(readFileSync(file, "utf-8"));
	const result = ThemeLint.Run({ Id: file, Name: file, Source: "BuiltIn", Defs: json.defs ?? {}, Tokens: json.theme ?? {} });
	for (const err of result.Errors)
	{
		console.log(`${relative(process.cwd(), file)} ${err.Token} ${err.Text}`);
		failed = true;
	}
	for (const warn of result.Warnings)
		console.log(`${relative(process.cwd(), file)} WARN ${warn.Token} ${warn.Text}`);
}
process.exit(failed ? 1 : 0);
