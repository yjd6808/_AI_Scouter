const kForbidden = new Set(["i", "j", "k"]);

export default {
	meta: { type: "suggestion", messages: { forbidden: "루프 카운터로 '{{name}}' 대신 'idx' 계열 이름을 사용하십시오" } },
	create(context)
	{
		return {
			ForStatement(node)
			{
				const decl = node.init?.type === "VariableDeclaration" ? node.init.declarations[0] : undefined;
				const name = decl?.id?.type === "Identifier" ? decl.id.name : undefined;
				if (name !== undefined && kForbidden.has(name))
					context.report({ node: decl.id, messageId: "forbidden", data: { name } });
			},
		};
	},
};
