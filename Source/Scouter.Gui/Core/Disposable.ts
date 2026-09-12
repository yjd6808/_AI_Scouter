/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: 폐기 계약. 구독·관찰자를 한 곳에 모아 해제한다.
*/

export interface IDisposable
{
	Dispose(): void;
}

export class DisposableBag implements IDisposable
{
	// ==================== 멤버 ====================
	private readonly items_: IDisposable[] = [];

	// ==================== 속성 ====================
	public get Size(): number { return this.items_.length; }

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 항목을 추가한다.
	// @param _item: 폐기 항목
	public Add(_item: IDisposable): void
	{
		this.items_.push(_item);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 전부 폐기하고 비운다. 두 번 호출해도 안전.
	public Dispose(): void
	{
		while (this.items_.length > 0)
			(this.items_.pop() as IDisposable).Dispose();
	}
}
