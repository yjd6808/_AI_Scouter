/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: node:test 전역 설정. happy-dom 등록 + 내장 태그 등록.
*/

import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { Gui } from "@scouter/gui";

GlobalRegistrator.register();
Gui.RegisterBuiltInElements();
