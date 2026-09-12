import tseslint from "typescript-eslint";
import stylistic from "@stylistic/eslint-plugin";
import scouter from "./Scripts/EslintPlugin/index.mjs";

export default tseslint.config(
	{ ignores: ["**/dist/**", "**/node_modules/**", "**/*.d.ts", "**/coverage/**", "**/.cache/**", "**/release/**"] },
	...tseslint.configs.strictTypeChecked,
	{
		languageOptions: { parserOptions: { projectService: true } },
		plugins: { "@stylistic": stylistic, scouter },
		rules:
		{
			"@stylistic/indent": ["error", "tab", { SwitchCase: 1 }],
			"@stylistic/brace-style": ["error", "allman", { allowSingleLine: true }],
			"@stylistic/quotes": ["error", "double"],
			"@stylistic/semi": ["error", "always"],
			"@typescript-eslint/explicit-member-accessibility": "error",
			"@typescript-eslint/no-explicit-any": "error",
			"@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" }],
			"@typescript-eslint/no-extraneous-class": "off",
			"@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
			"@typescript-eslint/naming-convention":
			[
				"error",
				{ selector: "class", format: ["PascalCase"] },
				{ selector: "interface", format: ["PascalCase"], prefix: ["I"] },
				{ selector: "typeAlias", format: ["PascalCase"] },
				{ selector: "enum", format: ["PascalCase"] },
				{ selector: "enumMember", format: ["PascalCase"] },
				{ selector: "parameter", format: ["camelCase"], leadingUnderscore: "require" },
				{ selector: "property", modifiers: ["private", "static"], format: ["camelCase"], prefix: ["s_"], trailingUnderscore: "require" },
				{ selector: "property", modifiers: ["protected", "static"], format: ["camelCase"], prefix: ["s_"], trailingUnderscore: "require" },
				{ selector: "property", modifiers: ["private"], format: ["camelCase"], trailingUnderscore: "require" },
				{ selector: "property", modifiers: ["protected"], format: ["camelCase"], trailingUnderscore: "require" },
				{ selector: "property", modifiers: ["public", "static"], format: ["PascalCase"] },
				{ selector: "property", modifiers: ["public"], format: ["PascalCase"] },
				{ selector: "method", modifiers: ["public"], format: ["PascalCase"] },
				{ selector: "method", format: ["PascalCase"] },
				{ selector: "typeMethod", format: ["camelCase", "PascalCase"] },
				{ selector: "objectLiteralProperty", format: ["camelCase", "PascalCase", "UPPER_CASE", "snake_case"] },
				{ selector: "objectLiteralMethod", format: ["camelCase", "PascalCase"] },
				{ selector: "typeProperty", format: ["camelCase", "PascalCase", "UPPER_CASE", "snake_case"] },
				{ selector: "variable", format: ["camelCase", "PascalCase"] },
				{ selector: "function", format: ["PascalCase"] },
			],
			"scouter/function-separator": "error",
			"scouter/file-header": "error",
			"scouter/no-loop-i": "error",
			"scouter/member-groups": "warn",
			"scouter/file-name": "error",
		},
	},
	{ files: ["Source/Scouter.Gui/**"], rules: { "no-restricted-imports": ["error", { patterns: ["electron", "node:*", "@scouter/app*"] }] } },
	{ files: ["Plugins/**", "Source/Scouter.App/Renderer/BuiltIn/**"], rules: { "no-restricted-imports": ["error", { patterns: ["@scouter/app/*", "../../Renderer/*"] }] } },
	{ files: ["**/*.test.ts"], rules: { "scouter/function-separator": "off", "scouter/member-groups": "off" } },
	{ files: ["**/*.mjs", "**/*.cjs"], extends: [tseslint.configs.disableTypeChecked], rules: { "scouter/file-header": "off", "@typescript-eslint/no-require-imports": "off" } },
);
