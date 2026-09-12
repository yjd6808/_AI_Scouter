export default {
	meta: { type: "layout", messages: { missing: "파일 첫머리에 작성자/생성일/설명 블록 헤더가 필요합니다", short: "파일 헤더 설명이 너무 짧습니다 (3자 이상)" } },
	create(context)
	{
		const src = context.sourceCode;
		return {
			Program(node)
			{
				const comments = src.getAllComments();
				const first = comments[0];
				if (first === undefined || first.type !== "Block" || first.loc.start.line !== 1)
				{
					context.report({ node, messageId: "missing" });
					return;
				}
				const text = first.value.replace(/\*/g, "").trim();
				if (text.length < 3)
					context.report({ node: first, messageId: "short" });
			},
		};
	},
};
