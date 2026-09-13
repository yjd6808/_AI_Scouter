/*
	작성자: 윤정도
	생성일: 2026-09-13
	=====
	설명: ToastLab 공용 타입. 알림 종류·전송 싱크.
*/

export type TToastKind = "info" | "success" | "warn" | "error";

export type TNotifySink = (_kind: TToastKind, _title: string, _message: string, _global: boolean) => void;

export type TMessageScope = "App" | "Global";
export type TMessageKind = "ok" | "yesno";
export type TMessageResult = "ok" | "yes" | "no" | "timeout" | "closed";

export type TMessageSink = (_scope: TMessageScope, _title: string, _message: string, _kind: TMessageKind, _durationSec: number, _topmost: boolean) => Promise<TMessageResult>;
