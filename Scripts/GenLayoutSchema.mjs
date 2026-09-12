import { writeFileSync } from "node:fs";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { Gui, ElementCatalog } from "../Source/Scouter.Gui/Index.ts";

await GlobalRegistrator.register();
Gui.RegisterBuiltInElements();

const schema = { tags: {} };
for (const tag of ElementCatalog.Names())
{
	const props = ElementCatalog.PropertiesOf(tag).map((p) => p.Name);
	schema.tags[tag] = props;
}
const out = process.argv[2] ?? "Source/Scouter.App/Config/Layout.schema.json";
writeFileSync(out, JSON.stringify(schema, null, 2));
console.log(`wrote ${out}`);
