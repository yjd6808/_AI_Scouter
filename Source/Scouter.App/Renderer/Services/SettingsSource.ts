/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: SettingsSource. Gui 바인딩이 Settings를 읽는 창구.
*/

import type { ISettingsSource } from "@scouter/gui";
import type { IDisposable } from "@scouter/gui";
import { Settings } from "./Settings";

export class SettingsSource implements ISettingsSource
{
	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 경로 값을 읽는다. 없으면 null.
	// @param _path: 경로
	public Get(_path: string): unknown
	{
		try
		{
			return Settings.Get<unknown>(_path);
		}
		catch
		{
			return null;
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 경로 변경을 구독한다.
	// @param _path: 경로
	// @param _handler: 핸들러
	public Subscribe(_path: string, _handler: () => void): IDisposable
	{
		return Settings.Changed.Add((_change) =>
		{
			if (_change.Key === _path || _change.Key.startsWith(`${_path}.`))
				_handler();
		});
	}
}
