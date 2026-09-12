import path from "node:path";

export default {
	meta: { type: "suggestion", messages: { mismatch: "파일 이름 '{{file}}'과(와) 일치하는 export 클래스가 없습니다 (첫 후보: {{cls}})" } },
	create(context)
	{
		const classes = [];
		return {
			"ExportNamedDeclaration > ClassDeclaration, ExportDefaultDeclaration > ClassDeclaration"(node)
			{
				if (node.id !== null)
					classes.push(node.id.name);
			},
			"Program:exit"(node)
			{
				if (classes.length === 0)
					return;
				const file = path.basename(context.filename, path.extname(context.filename));
				if (file.endsWith(".test"))
					return;
				if (file === "Index")
					return;
				if (file.endsWith("Definitions") || file.endsWith("Types"))
					return;
				const ok = classes.some((n) => n === file || n.startsWith(file) || n.endsWith(file));
				if (!ok)
					context.report({ node, messageId: "mismatch", data: { file, cls: classes[0] } });
			},
		};
	},
};
