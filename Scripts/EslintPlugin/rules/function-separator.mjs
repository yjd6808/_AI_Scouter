export default {
	meta: { type: "layout", fixable: "whitespace", messages: { missing: "메서드 위에 //// 구분선과 설명 주석이 필요합니다", length: "구분선 길이는 {{expected}}이어야 합니다" } },
	create(context)
	{
		const src = context.sourceCode;
		return {
			MethodDefinition(node)
			{
				if ((node.kind === "get" || node.kind === "set") && node.loc.start.line === node.loc.end.line)
					return;
				const comments = src.getCommentsBefore(node);
				const sepIdx = comments.findLastIndex((c) => c.type === "Line" && /^\/{2,}$/.test(c.value));
				const indent = node.loc.start.column;
				const expected = 90 - indent * 4;
				const desc = sepIdx >= 0 ? comments[sepIdx + 1] : undefined;
				if (sepIdx < 0 || desc === undefined || desc.type !== "Line" || desc.value.trim().length === 0)
				{
					context.report({ node, messageId: "missing", fix: (f) => f.insertTextBefore(node, `${"/".repeat(expected)}\n${"\t".repeat(indent)}// TODO: 설명\n${"\t".repeat(indent)}`) });
					return;
				}
				const sep = comments[sepIdx];
				if (sep.value.length + 2 !== expected)
					context.report({ node: sep, messageId: "length", data: { expected }, fix: (f) => f.replaceText(sep, "/".repeat(expected)) });
			},
		};
	},
};
