/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: 설정 메인 화면. 카테고리 리스트 + PropertyGrid 상세.
*/

import { UserControl, ListBox, ContentPresenter, PropertyGrid, DataList, UIManager } from "@scouter/gui";
import type { IJsonSchemaNode } from "@scouter/gui";
import { Settings } from "../../../Services/Settings";
import { SettingsCatalog } from "../SettingsCatalog";

export class SettingsMainControl extends UserControl
{
	// ==================== 멤버 ====================
	private grid_: PropertyGrid | null = null;
	private categoryId_ = "";

	// ==================== 확장점 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 카테고리를 채우고 첫 항목을 고른다.
	// @param _data: 바인딩 소스
	protected override OnInit(_data: DataList): void
	{
		const list = this.RequireName(ListBox, "lst_categories");
		const detail = this.RequireName(ContentPresenter, "detail");
		const categories = SettingsCatalog.Categories();
		list.SetItems(categories.map((_c) => _c.Title));
		list.SelectionChanged.Add(() =>
		{
			const idx = list.SelectedIndex;
			const category = categories[idx];
			if (category === undefined)
				return;
			if (category.Id === "Mcp")
			{
				detail.Content = UIManager.CreateUserControl("ScouterCore/Connect");
				return;
			}
			this.ShowCategory(detail, category.Id, category.Schema);
		});
		if (categories.length > 0)
			list.SelectedIndex = 0;
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 카테고리 스키마로 PropertyGrid를 깐다.
	// @param _detail: 상세 자리
	// @param _id: 카테고리 Id
	// @param _schema: 스키마
	private ShowCategory(_detail: ContentPresenter, _id: string, _schema: IJsonSchemaNode): void
	{
		if (this.grid_ === null)
		{
			this.grid_ = new PropertyGrid();
			this.grid_.ValueChanged.Add((_change) =>
			{
				try
				{
					Settings.Set(`${this.categoryId_}.${_change.Path}`, _change.Value);
				}
				catch
				{
					// 검증 실패는 PropertyGrid 표시 유지.
				}
			});
		}
		this.categoryId_ = _id;
		const values: Record<string, unknown> = {};
		for (const key of Object.keys(_schema.properties ?? {}))
		{
			try
			{
				values[key] = Settings.Get<unknown>(`${_id}.${key}`);
			}
			catch
			{
				continue;
			}
		}
		this.grid_.SetSchema(_schema, values);
		_detail.Content = this.grid_;
	}
}
