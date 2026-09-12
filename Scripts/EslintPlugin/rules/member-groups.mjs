export default {
	meta: { type: "suggestion", messages: { order: "멤버 그룹 주석 순서 위반: '{{found}}' (순서: 정적 → 멤버 → 생성 · 소멸 → 속성 → 이벤트 → 공개 메서드 → 확장점 → 내부)" } },
	create(context)
	{
		const kOrder = ["정적", "멤버", "생성 · 소멸", "속성", "이벤트", "공개 메서드", "확장점", "내부"];
		const src = context.sourceCode;
		return {
			ClassBody(node)
			{
				const groups = [];
				for (const c of src.getCommentsInside(node))
				{
					if (c.type !== "Line")
						continue;
					const m = /=+\s*(.+?)\s*=+/.exec(c.value);
					if (m !== null)
						groups.push(m[1].trim());
				}
				let lastIdx = -1;
				for (const g of groups)
				{
					const idx = kOrder.indexOf(g);
					if (idx < 0)
						continue;
					if (idx < lastIdx)
					{
						context.report({ node, messageId: "order", data: { found: g } });
						return;
					}
					lastIdx = idx;
				}
			},
		};
	},
};
