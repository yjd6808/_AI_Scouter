import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { Gui, LoadContext, LayoutLint } from "../Source/Scouter.Gui/Index.ts";

await GlobalRegistrator.register();
Gui.RegisterBuiltInElements();

const roots = process.argv.slice(2);
let failed = false;

function Collect(dir, out)
{
	for (const entry of readdirSync(dir))
	{
		const full = join(dir, entry);
		if (statSync(full).isDirectory())
		{
			Collect(full, out);
			continue;
		}
		if (entry.endsWith(".xml"))
			out.push(full);
	}
}

const files = [];
for (const root of roots)
	Collect(root, files);

for (const file of files)
{
	const xml = readFileSync(file, "utf-8");
	const messages = LayoutLint.LintXml(xml, new LoadContext());
	for (const msg of messages)
	{
		const rel = relative(process.cwd(), file);
		console.log(`${rel}:${msg.Line}:0 ${msg.Code} ${msg.Text}`);
		if (msg.Code.startsWith("E"))
			failed = true;
	}
}
process.exit(failed ? 1 : 0);
