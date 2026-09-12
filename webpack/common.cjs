const path = require("node:path");

module.exports = (_isDev) => ({
	mode: _isDev ? "development" : "production",
	devtool: _isDev ? "eval-cheap-module-source-map" : "source-map",
	resolve:
	{
		extensions: [".ts", ".js"],
		alias:
		{
			"@scouter/gui": path.resolve(__dirname, "../Source/Scouter.Gui/Index.ts"),
			"@scouter/plugin-api": path.resolve(__dirname, "../Source/Scouter.PluginApi/Index.ts"),
		},
	},
	module: { rules: [{ test: /\.ts$/, loader: "ts-loader", options: { transpileOnly: true, configFile: path.resolve(__dirname, "../tsconfig.base.json") } }] },
	stats: "errors-warnings",
});
