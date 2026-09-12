const path = require("node:path");
const common = require("./common.cjs");

module.exports = (_env, _argv) =>
{
	const isDev = _argv.mode !== "production";
	const base = common(isDev);
	return {
		...base,
		target: "electron-main",
		entry: { Main: "./Source/Scouter.App/Main/Main.ts" },
		output: { path: path.resolve(__dirname, "../dist/main"), filename: "[name].cjs", clean: true },
		externals: { electron: "commonjs electron" },
		node: { __dirname: false },
	};
};
