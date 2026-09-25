/*
	작성자: Scouter
	생성일: 2026-09-24
	=====
	설명: NetLink. TCP 리스너/클라이언트. final 텍스트 + 30초 하트비트.
	프로토콜: UTF-8, 줄바꿈 구분 JSON.
	  → {"type":"hello","nick":"..."} (접속 직후 1회)
	  ↔ {"type":"final","text":"..."} (final만 전송)
	  ↔ {"type":"ping","ts":123}
	  ← {"type":"error","msg":"..."} (서버→클라이언트 거부 통지)
*/

import * as net from "node:net";
import * as os from "node:os";
import type { PeerMessage, Role } from "./Types";
import { kHeartbeatMs } from "./Types";

export interface IPeerInfo
{
	Nick: string;
	Addr: string;
	Checked: boolean;
	LastHb: Date;
}

export interface ILinkEvents
{
	OnLog(_level: "info" | "warn" | "error", _msg: string): void;
	OnPeerFinal(_text: string, _nick: string): void;
	OnRole(_role: Role, _detail: string): void;
	OnHeartbeat(_at: Date, _nick: string): void;
	OnPeers(): void;
}

interface IPeerState
{
	Sock: net.Socket;
	Nick: string;
	Addr: string;
	Checked: boolean;
	LastHb: Date;
	Hello: boolean;
	Buf: string;
}

export class NetLink
{
	// ==================== 멤버 ====================
	private events_: ILinkEvents | null = null;
	private server_: net.Server | null = null;
	private socket_: net.Socket | null = null;
	private socketNick_ = "";
	private peers_ = new Map<net.Socket, IPeerState>();
	private role_: Role = "idle";
	private exclusive_ = true;
	private nickname_ = "";
	private heartbeatTimer_: NodeJS.Timeout | null = null;
	private lastHb_ = new Date(0);
	private clientBuf_ = "";

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 이벤트를 묶는다.
	// @param _events: 이벤트
	public Bind(_events: ILinkEvents): void
	{
		this.events_ = _events;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 현재 역할.
	public Role(): Role
	{
		return this.role_;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 내 닉네임. 비어 있으면 OS 호스트명.
	public Nickname(): string
	{
		if (this.nickname_.length > 0)
			return this.nickname_;
		try
		{
			return os.hostname();
		}
		catch
		{
			return "peer";
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 내 닉네임 지정.
	// @param _nick: 닉네임
	public SetNickname(_nick: string): void
	{
		this.nickname_ = _nick.trim();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 피어 스냅샷.
	public Peers(): IPeerInfo[]
	{
		const out: IPeerInfo[] = [];
		if (this.role_ === "connected" && this.socket_ !== null)
		{
			out.push({ Nick: this.socketNick_, Addr: "server", Checked: true, LastHb: this.lastHb_ });
		}
		for (const peer of this.peers_.values())
			out.push({ Nick: peer.Nick, Addr: peer.Addr, Checked: peer.Checked, LastHb: peer.LastHb });
		return out;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 대상 체크 토글 (리스너).
	// @param _nick: 닉네임
	public ToggleTarget(_nick: string): void
	{
		for (const peer of this.peers_.values())
		{
			if (peer.Nick === _nick)
			{
				peer.Checked = !peer.Checked;
				this.events_?.OnPeers();
				return;
			}
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 리스너로 시작한다. 연결 중이면 거부.
	// @param _host: 바인드 호스트
	// @param _port: 포트
	// @param _exclusive: 1:1 독점
	public StartListen(_host: string, _port: number, _exclusive: boolean): Promise<void>
	{
		if (this.role_ === "connected")
			return Promise.reject(new Error("클라이언트로 연결 중에는 리슨 불가"));
		if (this.role_ === "listening")
			return Promise.reject(new Error("이미 리슨 중"));
		this.exclusive_ = _exclusive;
		return new Promise((_resolve, _reject) =>
		{
			const server = net.createServer((_sock) =>
			{
				this.OnPeer(_sock);
			});
			server.on("error", (_e: unknown) =>
			{
				_reject(_e instanceof Error ? _e : new Error(String(_e)));
			});
			server.listen(_port, _host, () =>
			{
				this.server_ = server;
				this.SetRole("listening", `${_host}:${_port}`);
				this.events_?.OnLog("info", `리스너 시작 ${_host}:${_port}`);
				this.StartHeartbeat();
				_resolve();
			});
		});
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 클라이언트로 접속한다. 리슨 중이면 거부.
	// @param _host: 대상 호스트
	// @param _port: 포트
	public Connect(_host: string, _port: number): Promise<void>
	{
		if (this.role_ === "listening")
			return Promise.reject(new Error("리스너 동작 중에는 연결 불가"));
		if (this.role_ === "connected")
			return Promise.reject(new Error("이미 연결 중"));
		return new Promise((_resolve, _reject) =>
		{
			const sock = new net.Socket();
			sock.setEncoding("utf8");
			const remote = `${_host}:${_port}`;
			let done = false;
			const onErr = (_e: unknown): void =>
			{
				if (!done)
				{
					done = true;
					_reject(_e instanceof Error ? _e : new Error(String(_e)));
				}
			};
			sock.on("error", onErr);
			this.WireSocket(sock, remote, null);
			sock.connect(_port, _host, () =>
			{
				done = true;
				sock.removeListener("error", onErr);
				this.socket_ = sock;
				this.socketNick_ = "";
				this.SetRole("connected", remote);
				this.events_?.OnLog("info", `서버 접속 ${remote}`);
				this.SendLine(sock, { type: "hello", nick: this.Nickname() });
				this.StartHeartbeat();
				_resolve();
			});
		});
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 모두 끊고 idle로 복귀.
	public Stop(): void
	{
		this.StopHeartbeat();
		for (const peer of this.peers_.keys())
		{
			try
			{
				peer.destroy();
			}
			catch
			{
				// 무시.
			}
		}
		this.peers_.clear();
		if (this.socket_ !== null)
		{
			try
			{
				this.socket_.destroy();
			}
			catch
			{
				// 무시.
			}
			this.socket_ = null;
		}
		if (this.server_ !== null)
		{
			const server = this.server_;
			this.server_ = null;
			server.close();
		}
		if (this.role_ !== "idle")
		{
			this.SetRole("idle", "");
			this.events_?.OnLog("info", "링크 종료");
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// final 텍스트를 피어에게 전송. 리스너는 체크된 대상에게만.
	// @param _text: 텍스트
	public SendFinal(_text: string): void
	{
		if (this.role_ === "connected")
		{
			if (this.socket_ !== null)
				this.SendLine(this.socket_, { type: "final", text: _text });
			return;
		}
		let count = 0;
		for (const peer of this.peers_.values())
		{
			if (!peer.Checked || !peer.Hello)
				continue;
			this.SendLine(peer.Sock, { type: "final", text: _text });
			count++;
		}
		if (count === 0)
			this.events_?.OnLog("warn", "전송 대상 없음 (클라이언트 목록 우클릭 → 체크)");
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 역할 변경 통지.
	// @param _role: 역할
	// @param _detail: 상세
	private SetRole(_role: Role, _detail: string): void
	{
		this.role_ = _role;
		this.events_?.OnRole(_role, _detail);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 서버측 피어 접속 처리.
	// @param _sock: 소켓
	private OnPeer(_sock: net.Socket): void
	{
		const remote = `${_sock.remoteAddress ?? "?"}:${_sock.remotePort ?? "?"}`;
		if (this.exclusive_ && this.peers_.size > 0)
		{
			this.events_?.OnLog("warn", `1:1 독점: 접속 거부 ${remote}`);
			_sock.destroy();
			return;
		}
		_sock.setEncoding("utf8");
		const peer: IPeerState =
		{
			Sock: _sock,
			Nick: "",
			Addr: remote,
			Checked: true,
			LastHb: new Date(0),
			Hello: false,
			Buf: "",
		};
		this.peers_.set(_sock, peer);
		this.events_?.OnLog("info", `클라이언트 접속 시도 ${remote}`);
		this.WireSocket(_sock, remote, peer);
		// hello 없이 5초 버티면 끊는다.
		setTimeout(() =>
		{
			if (this.peers_.has(_sock))
			{
				const cur = this.peers_.get(_sock);
				if (cur !== undefined && !cur.Hello)
				{
					this.events_?.OnLog("warn", `닉네임 없음: 접속 해제 ${remote}`);
					_sock.destroy();
				}
			}
		}, 5000).unref();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 수신·종료 핸들러 연결.
	// @param _sock: 소켓
	// @param _remote: 표시명
	// @param _peer: 서버측 상태 (클라이언트 모드는 null)
	private WireSocket(_sock: net.Socket, _remote: string, _peer: IPeerState | null): void
	{
		_sock.on("data", (_chunk: string) =>
		{
			if (_peer !== null)
			{
				_peer.Buf += _chunk;
				this.DrainPeer(_peer);
			}
			else
			{
				this.DrainClient(_remote, _chunk);
			}
		});
		_sock.on("close", () =>
		{
			if (_peer !== null)
			{
				this.peers_.delete(_sock);
				const label = _peer.Nick.length > 0 ? _peer.Nick : _remote;
				this.events_?.OnLog("warn", `피어 끊어짐 ${label}`);
				this.events_?.OnPeers();
			}
			if (this.socket_ === _sock)
			{
				this.socket_ = null;
				this.events_?.OnLog("warn", `서버와 끊어짐 ${_remote}`);
				if (this.role_ === "connected")
					this.Stop();
			}
		});
		_sock.on("error", (_e: unknown) =>
		{
			this.events_?.OnLog("error", `소켓 오류 ${_remote}: ${_e instanceof Error ? _e.message : String(_e)}`);
		});
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 클라이언트 모드 수신 버퍼 처리.
	// @param _sock: 소켓
	// @param _remote: 표시명
	// @param _chunk: 조각
	private DrainClient(_remote: string, _chunk: string): void
	{
		this.clientBuf_ += _chunk;
		let at = this.clientBuf_.indexOf("\n");
		while (at >= 0)
		{
			const line = this.clientBuf_.slice(0, at).trim();
			this.clientBuf_ = this.clientBuf_.slice(at + 1);
			if (line.length > 0)
				this.OnClientLine(line, _remote);
			at = this.clientBuf_.indexOf("\n");
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 서버측 수신 버퍼 처리.
	// @param _peer: 상태
	private DrainPeer(_peer: IPeerState): void
	{
		let at = _peer.Buf.indexOf("\n");
		while (at >= 0)
		{
			const line = _peer.Buf.slice(0, at).trim();
			_peer.Buf = _peer.Buf.slice(at + 1);
			if (line.length > 0)
				this.OnPeerLine(_peer, line);
			at = _peer.Buf.indexOf("\n");
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 서버측 한 줄 처리. 첫 줄은 hello 강제.
	// @param _peer: 상태
	// @param _line: 원문
	private OnPeerLine(_peer: IPeerState, _line: string): void
	{
		let msg: PeerMessage;
		try
		{
			msg = JSON.parse(_line) as PeerMessage;
		}
		catch
		{
			return;
		}
		if (!_peer.Hello)
		{
			if (msg.type !== "hello" || msg.nick === undefined || msg.nick.trim().length === 0)
			{
				this.SendLine(_peer.Sock, { type: "error", msg: "닉네임 필요" });
				_peer.Sock.destroy();
				return;
			}
			const nick = msg.nick.trim();
			for (const other of this.peers_.values())
			{
				if (other !== _peer && other.Hello && other.Nick === nick)
				{
					this.events_?.OnLog("warn", `닉네임 중복: 거부 ${nick} (${_peer.Addr})`);
					this.SendLine(_peer.Sock, { type: "error", msg: "닉네임 중복" });
					_peer.Sock.destroy();
					this.peers_.delete(_peer.Sock);
					return;
				}
			}
			_peer.Hello = true;
			_peer.Nick = nick;
			this.events_?.OnLog("info", `클라이언트 접속 ${nick} (${_peer.Addr})`);
			this.events_?.OnPeers();
			return;
		}
		if (msg.type === "ping")
		{
			_peer.LastHb = new Date();
			this.lastHb_ = _peer.LastHb;
			this.events_?.OnHeartbeat(_peer.LastHb, _peer.Nick);
		}
		else if (msg.type === "final")
		{
			this.events_?.OnLog("info", `수신 [${_peer.Nick}] ${msg.text}`);
			this.events_?.OnPeerFinal(msg.text, _peer.Nick);
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 클라이언트 모드 한 줄 처리.
	// @param _line: 원문
	// @param _remote: 표시명
	private OnClientLine(_line: string, _remote: string): void
	{
		let msg: PeerMessage;
		try
		{
			msg = JSON.parse(_line) as PeerMessage;
		}
		catch
		{
			return;
		}
		if (msg.type === "ping")
		{
			this.lastHb_ = new Date();
			this.events_?.OnHeartbeat(this.lastHb_, _remote);
		}
		else if (msg.type === "final")
		{
			this.events_?.OnLog("info", `수신 [${_remote}] ${msg.text}`);
			this.events_?.OnPeerFinal(msg.text, _remote);
		}
		else if (msg.type === "error")
		{
			this.events_?.OnLog("error", `서버 거부: ${msg.msg ?? ""}`);
		}
		else
		{
			// ping/final/error가 아니면 hello만 남는다.
			if (msg.nick !== undefined)
			{
				this.socketNick_ = msg.nick;
				this.events_?.OnPeers();
			}
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 한 줄 전송.
	// @param _sock: 소켓
	// @param _msg: 메시지
	private SendLine(_sock: net.Socket, _msg: PeerMessage): void
	{
		try
		{
			_sock.write(JSON.stringify(_msg) + "\n");
		}
		catch
		{
			// 무시.
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 30초 하트비트 시작.
	private StartHeartbeat(): void
	{
		this.StopHeartbeat();
		this.SendHeartbeat();
		this.heartbeatTimer_ = setInterval(() =>
		{
			this.SendHeartbeat();
		}, kHeartbeatMs);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 하트비트 1회 송신.
	private SendHeartbeat(): void
	{
		const msg: PeerMessage = { type: "ping", ts: Date.now() };
		if (this.role_ === "connected")
		{
			if (this.socket_ !== null)
				this.SendLine(this.socket_, msg);
			return;
		}
		for (const peer of this.peers_.values())
		{
			if (!peer.Hello)
				continue;
			this.SendLine(peer.Sock, msg);
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 하트비트 중지.
	private StopHeartbeat(): void
	{
		if (this.heartbeatTimer_ !== null)
		{
			clearInterval(this.heartbeatTimer_);
			this.heartbeatTimer_ = null;
		}
	}
}
