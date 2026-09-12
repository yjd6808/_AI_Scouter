/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: 항목 컨트롤 등록 갈고리. 데코레이터가 이미 등록하므로 재수출만 한다.
*/

import { Gui } from "../../Core/Gui";

Gui.OnRegister(() =>
{
	// P4: ListBox 계열·Tab·ListView·Popup 등은 데코레이터로 등록됨.
});

export { SelectionModel } from "./SelectionModel";
export type { ISelectionDiff } from "./SelectionModel";
export { ItemContainerGenerator, ItemsControl } from "./ItemsControl";
export { Selector, SelectionMode, SelectionSource, SelectionChangedEventArgs } from "./Selector";
export { ListBox, ListBoxItem } from "./ListBox";
export { ComboBox } from "./ComboBox";
export { TabControl, TabItem } from "./TabControl";
export { ListView, GridView, GridViewColumn, GridViewHeaderArgs } from "./ListView";
export type { IGridViewColumnDef } from "./ListView";
export { Popup, PopupPlacer } from "./Popup";
export type { PlacementKind, IPlacementRect } from "./Popup";
export { ToolTipService } from "./ToolTipService";
export { Expander, GroupBox } from "./Expander";
export { TreeView, TreeViewItem } from "./TreeView";
export type { ITreeAdapter, ITreeRow } from "./TreeView";
export { MenuBase, Menu, MenuItem } from "./Menu";
export { ContextMenu } from "./ContextMenu";
export { ToolBar } from "./ToolBar";
export { DataGrid } from "./DataGrid";
