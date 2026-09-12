import functionSeparator from "./rules/function-separator.mjs";
import fileHeader from "./rules/file-header.mjs";
import noLoopI from "./rules/no-loop-i.mjs";
import memberGroups from "./rules/member-groups.mjs";
import fileName from "./rules/file-name.mjs";

export default {
	rules:
	{
		"function-separator": functionSeparator,
		"file-header": fileHeader,
		"no-loop-i": noLoopI,
		"member-groups": memberGroups,
		"file-name": fileName,
	},
};
