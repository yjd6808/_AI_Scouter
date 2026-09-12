import { RuleTester } from "eslint";
import functionSeparator from "../rules/function-separator.mjs";
import noLoopI from "../rules/no-loop-i.mjs";
import fileHeader from "../rules/file-header.mjs";

const tester = new RuleTester({ languageOptions: { ecmaVersion: 2022, sourceType: "module" } });

tester.run("function-separator", functionSeparator, {
	valid: [{ code: "class A {\n\t//////////////////////////////////////////////////////////////////////////////////////\n\t// 설명\n\tFoo() {}\n}" }],
	invalid: [{ code: "class A {\n\tFoo() {}\n}", output: "class A {\n\t//////////////////////////////////////////////////////////////////////////////////////\n\t// TODO: 설명\n\tFoo() {}\n}", errors: [{ messageId: "missing" }] }],
});

tester.run("no-loop-i", noLoopI, {
	valid: [{ code: "for (let idx = 0; idx < 3; ++idx) {}" }],
	invalid: [{ code: "for (let i = 0; i < 3; ++i) {}", errors: [{ messageId: "forbidden" }] }],
});

tester.run("file-header", fileHeader, {
	valid: [{ code: "/*\n작성자: 윤정도\n설명: 테스트\n*/\nconst a = 1;" }],
	invalid: [{ code: "const a = 1;", errors: [{ messageId: "missing" }] }],
});
