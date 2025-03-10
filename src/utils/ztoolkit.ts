import {
	BasicTool,
	makeHelperTool,
	MenuManager,
	ProgressWindowHelper,
	UITool,
	unregister,
} from "zotero-plugin-toolkit";
import { config } from "../../package.json";

export { createZToolkit };

function createZToolkit() {
	const _ztoolkit = new MyToolkit();
	initZToolkit(_ztoolkit);
	return _ztoolkit;
}

function initZToolkit(_ztoolkit: ReturnType<typeof createZToolkit>) {
	const env = __env__;
	_ztoolkit.basicOptions.log.prefix = `[${config.addonName}]`;
	_ztoolkit.basicOptions.log.disableConsole = env === "production";
	_ztoolkit.UI.basicOptions.ui.enableElementJSONLog =
		__env__ === "development";
	_ztoolkit.UI.basicOptions.ui.enableElementDOMLog =
		__env__ === "development";
	_ztoolkit.basicOptions.debug.disableDebugBridgePassword =
		__env__ === "development";
	_ztoolkit.basicOptions.api.pluginID = config.addonID;
	_ztoolkit.ProgressWindow.setIconURI(
		"default",
		`chrome://${config.addonRef}/content/icons/favicon.png`,
	);
}

class MyToolkit extends BasicTool {
	UI: UITool;
	Menu: MenuManager;
	ProgressWindow: typeof ProgressWindowHelper;

	constructor() {
		super();
		this.UI = new UITool(this);
		this.Menu = new MenuManager(this);
		this.ProgressWindow = makeHelperTool(ProgressWindowHelper, this);
	}

	unregisterAll() {
		unregister(this);
	}
}
