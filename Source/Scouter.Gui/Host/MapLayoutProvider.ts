/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: 메모리 레이아웃 제공자. 테스트·하네스용.
*/

import type { ILayoutProvider } from "./ILayoutProvider";

export class MapLayoutProvider implements ILayoutProvider
{
	// ==================== 멤버 ====================
	private readonly xmls_ = new Map<string, string>();

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 메모리 XML을 등록한다. 테스트·하네스용.
	// @param _name: 창 이름
	// @param _xml: XML 문자열
	public Add(_name: string, _xml: string): void
	{
		this.xmls_.set(_name, _xml);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 이름으로 XML을 구한다.
	// @param _name: 창 이름
	public Resolve(_name: string): Promise<string | null>
	{
		return Promise.resolve(this.xmls_.get(_name) ?? null);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 경로 조회. 메모리 제공자는 이름 그대로.
	// @param _name: 창 이름
	public PathOf(_name: string): string | null
	{
		return this.xmls_.has(_name) ? _name : null;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 역조회. 메모리 제공자는 경로 그대로.
	// @param _path: 경로
	public NameOf(_path: string): string | null
	{
		return this.xmls_.has(_path) ? _path : null;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 감시 폴더. 메모리 제공자는 없음.
	public WatchDirs(): string[]
	{
		return [];
	}
}
