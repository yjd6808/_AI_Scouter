/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: Screenshot Tool. IPC 캡처 → image 블록.
*/

import type { ITool } from "@scouter/plugin-api";
import { Ipc } from "../../../Services/Ipc";

export class ScreenshotTool implements ITool
{
	// ==================== 멤버 ====================
	public readonly Name = "Screenshot";
	public readonly Description = "화면을 캡처한다.";
	public readonly InputSchema = { type: "object", properties: { Name: { type: "string" } } };
	public readonly Annotations = { ReadOnly: true };

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// Name은 무시하고 전체를 찍는다(요소 영역 지정은 E2E 전용).
	public async Run(): Promise<unknown>
	{
		const shot = await Ipc.Invoke<{ Png?: string }>("app:capture-page");
		if (shot?.Png === undefined || shot.Png.length === 0)
			throw new Error("캡처 실패");
		return { Content: [{ Type: "image", Base64: shot.Png, MimeType: "image/png" }] };
	}
}
