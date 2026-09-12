/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: 바인딩 AST. 식·참조 노드 정의다.
*/

export type RefNode =
	| { Kind: "DataRef"; Key: string; Pos: number }
	| { Kind: "ElementRef"; Name: string; Prop: string; Pos: number }
	| { Kind: "SpecialRef"; Source: string; Path: string[]; Pos: number };

export type AstNode =
	| { Kind: "Literal"; Text: string; Pos: number }
	| { Kind: "Ref"; Ref: RefNode }
	| { Kind: "Binary"; Op: string; Left: AstNode; Right: AstNode; Pos: number }
	| { Kind: "Unary"; Op: string; Operand: AstNode; Pos: number }
	| { Kind: "Ternary"; Cond: AstNode; WhenTrue: AstNode; WhenFalse: AstNode; Pos: number }
	| { Kind: "Call"; Name: string; Args: AstNode[]; Pos: number };

export enum BindingMode
{
	Interpolate = "Interpolate",
	Expression = "Expression",
}

export interface IParsedBinding
{
	Mode: BindingMode;
	Parts: Array<string | AstNode>;
	Refs: RefNode[];
}

export class AstRefs
{
	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// AST에서 참조 노드를 전부 모은다.
	// @param _node: 루트
	public static Collect(_node: AstNode): RefNode[]
	{
		const out: RefNode[] = [];
		AstRefs.Walk(_node, out);
		return out;
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 재귀 순회.
	// @param _node: 노드
	// @param _out: 수집지
	private static Walk(_node: AstNode, _out: RefNode[]): void
	{
		switch (_node.Kind)
		{
			case "Ref": _out.push(_node.Ref); break;
			case "Binary": AstRefs.Walk(_node.Left, _out); AstRefs.Walk(_node.Right, _out); break;
			case "Unary": AstRefs.Walk(_node.Operand, _out); break;
			case "Ternary": AstRefs.Walk(_node.Cond, _out); AstRefs.Walk(_node.WhenTrue, _out); AstRefs.Walk(_node.WhenFalse, _out); break;
			case "Call":
				for (const arg of _node.Args)
					AstRefs.Walk(arg, _out);
				break;
			default: break;
		}
	}
}
