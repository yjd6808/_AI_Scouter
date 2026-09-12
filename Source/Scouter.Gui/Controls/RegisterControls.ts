/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: 컨트롤 등록 갈고리. 데코레이터가 이미 등록하므로 재수출만 한다.
*/

import { Gui } from "../Core/Gui";

Gui.OnRegister(() =>
{
	// P3: Button 계열·TextBlock·Icon·Separator·Scouter 컨트롤은 데코레이터로 등록됨.
});

export { ButtonBase, ClickMode } from "./ButtonBase";
export { Button } from "./Button";
export { RepeatButton } from "./RepeatButton";
export { ToggleButton } from "./ToggleButton";
export { CheckBox } from "./CheckBox";
export { RadioButton } from "./RadioButton";
export { RadioGroupScope } from "./RadioGroupScope";
export { TextBlock } from "./TextBlock";
export { TextBox } from "./TextBox";
export { PasswordBox } from "./PasswordBox";
export { Label } from "./Label";
export { RangeBase, ProgressBar, Slider, NumericUpDown } from "./Range";
export { Image } from "./Image";
export { Icon } from "./Icon";
export { VirtualList } from "./Scouter/VirtualList";
export { RingBuffer } from "./Scouter/RingBuffer";
export { LogView } from "./Scouter/LogView";
export type { ILogEntry, LogLevel } from "./Scouter/LogView";
export { Badge } from "./Scouter/Badge";
export { PropertyGrid, EditorFactory } from "./Scouter/PropertyGrid";
export type { IJsonSchemaNode, IPropertyEditor } from "./Scouter/PropertyGrid";
export { Separator } from "./Separator";
export { Control } from "./Control";
export { ContentControl } from "./ContentControl";
export { ContentPresenter } from "./ContentPresenter";
export { RegisterElement } from "./RegisterElement";
export { TitleBar } from "./Scouter/TitleBar";
export type { IWindowChrome } from "./Scouter/IWindowChrome";
export { StatusBar, StatusBarItem } from "./Scouter/StatusBar";
export { StatusDot, DotStatus } from "./Scouter/StatusDot";
export { Spinner } from "./Scouter/Spinner";
export { ToastService } from "./Scouter/ToastService";
export type { IToastOptions, ToastHandle } from "./Scouter/ToastService";
