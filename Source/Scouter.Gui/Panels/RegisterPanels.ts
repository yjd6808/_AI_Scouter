/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: 패널 태그 등록. Core→Panels 순환 없이 팩토리에 꽂는다.
*/

import { Gui } from "../Core/Gui";
import { Grid } from "./Grid";
import { StackPanel } from "./StackPanel";
import { DockPanel } from "./DockPanel";
import { WrapPanel } from "./WrapPanel";
import { Canvas } from "./Canvas";
import { UniformGrid } from "./UniformGrid";
import { Border } from "./Border";
import { ScrollViewer } from "./ScrollViewer";
import { Viewbox } from "./Viewbox";
import { GridSplitter } from "./GridSplitter";

Gui.OnRegister(() =>
{
	Gui.RegisterElement("Grid", Grid);
	Gui.RegisterElement("StackPanel", StackPanel);
	Gui.RegisterElement("DockPanel", DockPanel);
	Gui.RegisterElement("WrapPanel", WrapPanel);
	Gui.RegisterElement("Canvas", Canvas);
	Gui.RegisterElement("UniformGrid", UniformGrid);
	Gui.RegisterElement("Border", Border);
	Gui.RegisterElement("ScrollViewer", ScrollViewer);
	Gui.RegisterElement("Viewbox", Viewbox);
	Gui.RegisterElement("GridSplitter", GridSplitter);
});

export { Grid } from "./Grid";
export { StackPanel } from "./StackPanel";
export { DockPanel } from "./DockPanel";
export { WrapPanel } from "./WrapPanel";
export { Canvas } from "./Canvas";
export { UniformGrid } from "./UniformGrid";
export { Border } from "./Border";
export { ScrollViewer, ScrollBarVisibility } from "./ScrollViewer";
export { Viewbox, Stretch } from "./Viewbox";
export { GridSplitter, ResizeDirection } from "./GridSplitter";
export { Panel } from "./Panel";
export { Decorator } from "./Decorator";
export { AttachedProperty } from "./AttachedProperty";
export type { IAttachedMeta } from "./AttachedProperty";
export { GridLength, GridUnitType, RowDefinition, ColumnDefinition, DefinitionCollection } from "./GridDefinitions";
