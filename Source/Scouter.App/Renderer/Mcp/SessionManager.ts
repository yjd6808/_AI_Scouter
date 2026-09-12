/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: SessionManager. 세션 생성·조회·유휴 정리.
*/
/* eslint-disable @typescript-eslint/no-deprecated -- D-19: 동적 Tool 목록에 저수준 Server 필요 */

import { SimpleEvent } from "@scouter/gui";
import type { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";

export interface ISessionInfo
{
	Id: string;
	Client: string;
	CreatedAt: number;
	LastSeen: number;
	CallCount: number;
}

export interface ISession
{
	Id: string;
	Client: string;
	CreatedAt: number;
	LastSeen: number;
	CallCount: number;
	AlwaysAllow: Set<string>;
	Transport: StreamableHTTPServerTransport;
	Server: Server;
}

export class SessionManager
{
	// ==================== 멤버 ====================
	private readonly sessions_ = new Map<string, ISession>();
	private sweepTimer_: ReturnType<typeof setInterval> | null = null;
	private idleMinutes_ = 30;

	// ==================== 이벤트 ====================
	public readonly Changed = new SimpleEvent<void>();

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 유휴 정리를 시작한다.
	// @param _idleMinutes: 유휴 분
	public Start(_idleMinutes: number): void
	{
		this.idleMinutes_ = _idleMinutes;
		this.Stop();
		this.sweepTimer_ = setInterval(() =>
		{
			this.Sweep();
		}, 60000);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 정리를 멈춘다.
	public Stop(): void
	{
		if (this.sweepTimer_ !== null)
		{
			clearInterval(this.sweepTimer_);
			this.sweepTimer_ = null;
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 세션을 만든다. transport 연결 후 onsessioninitialized에서 호출.
	// @param _id: 세션 Id
	// @param _transport: 트랜스포트
	// @param _server: sdk 서버
	// @param _client: 클라이언트 표시
	public Create(_id: string, _transport: StreamableHTTPServerTransport, _server: Server, _client: string): ISession
	{
		const session: ISession = {
			Id: _id, Client: _client, CreatedAt: Date.now(), LastSeen: Date.now(), CallCount: 0,
			AlwaysAllow: new Set(), Transport: _transport, Server: _server,
		};
		this.sessions_.set(_id, session);
		this.Changed.Invoke(undefined);
		return session;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 세션을 찾는다. 찾으면 LastSeen 갱신.
	// @param _id: 세션 Id
	public Get(_id: string): ISession | null
	{
		const session = this.sessions_.get(_id);
		if (session === undefined)
			return null;
		session.LastSeen = Date.now();
		return session;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 세션을 닫고 지운다.
	// @param _id: 세션 Id
	public async RemoveAsync(_id: string): Promise<void>
	{
		const session = this.sessions_.get(_id);
		if (session === undefined)
			return;
		this.sessions_.delete(_id);
		try
		{
			await session.Transport.close();
		}
		catch
		{
			// 무시.
		}
		this.Changed.Invoke(undefined);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 전 세션을 닫는다. 토큰 재발급용.
	public async CloseAllAsync(): Promise<void>
	{
		const ids = [...this.sessions_.keys()];
		for (const id of ids)
			await this.RemoveAsync(id);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 목록을 반환한다. 상태바·Inspector용.
	public List(): ISessionInfo[]
	{
		return [...this.sessions_.values()].map((_s) => ({ Id: _s.Id, Client: _s.Client, CreatedAt: _s.CreatedAt, LastSeen: _s.LastSeen, CallCount: _s.CallCount }));
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 유휴 세션을 정리한다.
	private Sweep(): void
	{
		const cutoff = Date.now() - this.idleMinutes_ * 60000;
		for (const [id, session] of [...this.sessions_])
		{
			if (session.LastSeen < cutoff)
				void this.RemoveAsync(id);
		}
	}
}
