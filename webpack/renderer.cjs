const path = require("node:path");
const CopyPlugin = require("copy-webpack-plugin");
const HtmlPlugin = require("html-webpack-plugin");
const MonacoWebpackPlugin = require("monaco-editor-webpack-plugin");
const common = require("./common.cjs");

module.exports = (_env, _argv) =>
{
	const isDev = _argv.mode !== "production";
	const base = common(isDev);
	return {
		...base,
		target: "electron-renderer",
		entry: { renderer: "./Source/Scouter.App/Renderer/Bootstrap.ts" },
		output: { path: path.resolve(__dirname, "../dist/renderer"), filename: "[name].js", chunkFilename: "[name].[contenthash].js", clean: true, publicPath: "./" },
		module: { rules: [...base.module.rules, { test: /\.css$/, use: ["style-loader", "css-loader"] }, { test: /\.ttf$/, type: "asset/resource" }] },
		externals: { esbuild: "commonjs esbuild" },
		plugins:
		[
			new HtmlPlugin({ template: "./Source/Scouter.App/Renderer/Index.html", filename: "Index.html" }),
			new MonacoWebpackPlugin({ languages: ["typescript", "javascript", "json", "xml", "markdown", "cpp", "csharp", "powershell", "shell", "yaml"], features: ["find", "folding", "bracketMatching", "wordHighlighter", "clipboard", "contextmenu"], filename: "monaco/[name].worker.js" }),
			new CopyPlugin({ patterns: [
				{ from: "Source/Scouter.App/Renderer/Layout", to: "Layout", noErrorOnMissing: true },
				{ from: "Source/Scouter.App/Renderer/BuiltIn", to: "Layout", filter: (p) => p.includes(`${path.sep}Layout${path.sep}`) && p.endsWith(".xml"), noErrorOnMissing: true },
				{ from: "Source/Scouter.App/Config", to: "Config", noErrorOnMissing: true },
				{ from: "Source/Scouter.App/Renderer/BuiltIn/ScouterCore/Templates/Plugin", to: "Templates/Plugin", noErrorOnMissing: true },
			] }),
		],
	};
};
