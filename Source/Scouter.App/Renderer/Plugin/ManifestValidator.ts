/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: ManifestValidator. ajv로 검증 + 기본값 주입.
*/

import Ajv from "ajv";
import type { ValidateFunction } from "ajv";
import type { IPluginManifest } from "@scouter/plugin-api";
import schemaJson from "../../Config/Plugin.schema.json" with { type: "json" };

export class ManifestValidator
{
	// ==================== 정적 ====================
	private static s_validate_: ValidateFunction | null = null;

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// JSON을 검증하고 Manifest로 굳힌다. 실패하면 throw.
	// @param _json: 파싱된 Plugin.json
	public static Validate(_json: unknown): IPluginManifest
	{
		if (ManifestValidator.s_validate_ === null)
		{
			const ajv = new Ajv({ allErrors: true, useDefaults: true });
			ManifestValidator.s_validate_ = ajv.compile(schemaJson);
		}
		const validate = ManifestValidator.s_validate_;
		if (!validate(_json))
		{
			const first = validate.errors?.[0];
			throw new Error(`[Manifest] 검증 실패: ${first?.instancePath ?? ""} ${first?.message ?? ""}`);
		}
		return _json as IPluginManifest;
	}
}
