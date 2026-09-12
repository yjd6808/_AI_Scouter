/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: node:http 위의 40줄 라우터. express 없이 메서드+경로로 분기한다.
*/

import type { IncomingMessage, ServerResponse } from "node:http";

export type RouteHandler = (_req: IncomingMessage, _res: ServerResponse) => void | Promise<void>;

interface IRouteEntry
{
	Method: string;
	Path: string;
	Handler: RouteHandler;
}

export class Router
{
	// ==================== 멤버 ====================
	private readonly routes_: IRouteEntry[] = [];

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 라우트를 등록한다.
	// @param _method: HTTP 메서드
	// @param _path: 경로 (쿼리 제외 완전 일치)
	// @param _handler: 핸들러
	public Add(_method: string, _path: string, _handler: RouteHandler): void
	{
		this.routes_.push({ Method: _method, Path: _path, Handler: _handler });
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 요청을 분기한다. 일치 없으면 false.
	// @param _req: 요청
	// @param _res: 응답
	public async Dispatch(_req: IncomingMessage, _res: ServerResponse): Promise<boolean>
	{
		const url = new URL(_req.url ?? "/", "http://127.0.0.1");
		for (const route of this.routes_)
		{
			if (route.Method === (_req.method ?? "") && route.Path === url.pathname)
			{
				await route.Handler(_req, _res);
				return true;
			}
		}
		return false;
	}
}
