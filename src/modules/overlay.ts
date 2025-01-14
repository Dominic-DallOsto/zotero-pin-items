import { config } from "../../package.json";
import { getString } from "../utils/locale";
import {
	getItemExtraProperty,
	setItemExtraProperty,
	clearItemExtraProperty,
} from "../utils/extraField";
import {
	getPref,
	initialiseDefaultPref,
	getPrefGlobalName,
} from "../utils/prefs";

const PIN_ITEMS_COLUMN_ID = "pinitems";
const PINNED_EXTRA_FIELD = "Pinned_Collections";
const PREF_SORT_ORDER = "pinitems-sort-order";
enum SortOrder {
	Ascending = 0,
	Descending = 1,
}

const PREF_SORT_ORDER_FILES = "pinitems-sort-order-files";
enum SortOrderFiles {
	Before = 0,
	After = 1,
}

export default class ZoteroPinItems {
	pinItemsColumnId?: string | false;
	preferenceUpdateObservers?: symbol[];

	constructor() {
		this.initialiseDefaultPreferences();
		this.addPinItemsColumn();
		this.addRightClickMenuItems();
		this.addOverlayStyleSheet();
		this.addPreferencesMenu();
		this.addPreferenceUpdateObservers();
	}

	public unload() {
		this.removePinItemsColumn();
		this.removeRightClickMenuItems();
		this.removePreferencesMenu();
		this.removePreferenceUpdateObservers();
	}

	initialiseDefaultPreferences() {
		initialiseDefaultPref(PREF_SORT_ORDER, SortOrder.Ascending);
		initialiseDefaultPref(PREF_SORT_ORDER_FILES, SortOrderFiles.After);
	}

	addPinItemsColumn() {
		this.pinItemsColumnId = Zotero.ItemTreeManager.registerColumn({
			dataKey: PIN_ITEMS_COLUMN_ID,
			// If we just want to show the icon, overwrite the label with htmlLabel (#1)
			htmlLabel: `<span xmlns="http://www.w3.org/1999/xhtml" class="icon icon-css icon-16" style="background: url(chrome://zotero/skin/16/universal/pin.svg) content-box no-repeat center/contain; fill: var(--fill-secondary); -moz-context-properties: fill;" />`,
			iconPath: "chrome://zotero/skin/16/universal/pin.svg", // this hides the sorting arrow
			label: getString("pinitems-column-name"),
			pluginID: config.addonID,
			dataProvider: (item: Zotero.Item, dataKey: string) => {
				return item.isRegularItem()
					? this.isItemPinned(item)
						? "T"
						: getPref(PREF_SORT_ORDER) == SortOrder.Ascending
							? "Z" // ascending: Z comes after T so secondary column will be sorted ascending if pinned items are on top
							: "F" // descending: F comes before T so secondary column will be sorted descending if pinned items are on top
					: getPref(PREF_SORT_ORDER_FILES) == SortOrderFiles.Before
						? "A" // "A" comes before "T", "F", or "Z"
						: "ZZ"; // "ZZ" comes after "T", "F", or "Z"
			},
			renderCell: (
				index: number,
				data: string,
				column: { className: string },
			) => {
				const cell = this.createSpanElement(
					`cell ${column.className}`,
					"",
				);
				if (data === "T") {
					const icon = this.createSpanElement("icon icon-css", "");
					icon.style.cssText +=
						"background: url(chrome://zotero/skin/16/universal/pin.svg) content-box no-repeat center/contain; fill: var(--fill-secondary); -moz-context-properties: fill; width: 12px; height: 12px; padding: 1px; box-sizing: content-box;";
					cell.append(icon);
				}

				return cell;
			},
			fixedWidth: true,
			width: "32",
			zoteroPersist: ["width", "hidden", "sortDirection"],
		});
	}

	createSpanElement(className: string, innerText: string) {
		const span = document.createXULElement("span") as HTMLSpanElement;
		span.className = className;
		span.innerText = innerText;
		return span;
	}

	removePinItemsColumn() {
		if (this.pinItemsColumnId) {
			Zotero.ItemTreeManager.unregisterColumn(this.pinItemsColumnId);
			this.pinItemsColumnId = undefined;
		}
	}

	getItemPinnedCollections(item: Zotero.Item) {
		// value looks like
		// Pinned_Collections: collectionKey1,collectionKey2,collectionKey3
		const pinnedCollections = getItemExtraProperty(
			item,
			PINNED_EXTRA_FIELD,
		);
		if (pinnedCollections.length > 0) {
			return pinnedCollections[0].split(",");
		} else return [];
	}

	setItemPinnedCollections(item: Zotero.Item, collections: string[]) {
		if (collections.length > 0) {
			setItemExtraProperty(
				item,
				PINNED_EXTRA_FIELD,
				collections.join(","),
			);
		} else {
			clearItemExtraProperty(item, PINNED_EXTRA_FIELD);
		}
	}

	isItemPinned(item: Zotero.Item) {
		return this.getItemPinnedCollections(item).includes(
			ZoteroPane.getSelectedCollection()?.key || "library",
		);
	}

	pinItem(item: Zotero.Item) {
		const pinnedCollections = this.getItemPinnedCollections(item);
		const currentCollection =
			ZoteroPane.getSelectedCollection()?.key || "library";
		if (!pinnedCollections.includes(currentCollection)) {
			pinnedCollections.push(currentCollection);
			this.setItemPinnedCollections(item, pinnedCollections);
			void item.saveTx();
		}
	}

	unpinItem(item: Zotero.Item) {
		const pinnedCollections = this.getItemPinnedCollections(item);
		const currentCollection =
			ZoteroPane.getSelectedCollection()?.key || "library";
		if (pinnedCollections.includes(currentCollection)) {
			this.setItemPinnedCollections(
				item,
				pinnedCollections.filter((key) => key != currentCollection),
			);
			void item.saveTx();
		}
	}

	addRightClickMenuItems() {
		ztoolkit.Menu.register(
			"item",
			{
				id: "zotero-pin-items-pin",
				tag: "menuitem",
				label: getString("pin-item"),
				icon: "chrome://zotero/skin/16/universal/pin.svg",
				getVisibility: (element, event) => {
					const selectedItems = ZoteroPane.getSelectedItems().filter(
						(item) => item.isRegularItem(),
					);
					if (selectedItems.length > 1) {
						(element as XULMenuItemElement).label =
							getString("pin-items");
						return true; // multiple selected - show both
					} else if (selectedItems.length == 1) {
						(element as XULMenuItemElement).label =
							getString("pin-item");
						return !this.isItemPinned(selectedItems[0]); // not pinned - show pin button
					} else {
						return false;
					}
				},
				commandListener: (event) => {
					ZoteroPane.getSelectedItems()
						.filter((item) => item.isRegularItem())
						.forEach((item) => this.pinItem(item));
				},
			},
			"after",
			Zotero.getMainWindow().document.querySelector(
				".menuitem-iconic.zotero-menuitem-reindex",
			) as XULMenuItemElement,
		);
		ztoolkit.Menu.register(
			"item",
			{
				id: "zotero-pin-items-unpin",
				tag: "menuitem",
				label: getString("unpin-item"),
				icon: "chrome://zotero/skin/16/universal/pin-remove.svg",
				getVisibility: (element, event) => {
					const selectedItems = ZoteroPane.getSelectedItems().filter(
						(item) => item.isRegularItem(),
					);
					if (selectedItems.length > 1) {
						(element as XULMenuItemElement).label =
							getString("unpin-items");
						return true; // multiple selected - show both
					} else if (selectedItems.length == 1) {
						(element as XULMenuItemElement).label =
							getString("unpin-item");
						return this.isItemPinned(selectedItems[0]); // pinned - show unpin button
					} else {
						return false;
					}
				},
				commandListener: (event) => {
					ZoteroPane.getSelectedItems()
						.filter((item) => item.isRegularItem())
						.forEach((item) => this.unpinItem(item));
				},
			},
			"after",
			Zotero.getMainWindow().document.querySelector(
				"#zotero-pin-items-pin",
			) as XULMenuItemElement,
		);
	}

	removeRightClickMenuItems() {
		ztoolkit.Menu.unregister("zotero-pin-items-pin");
		ztoolkit.Menu.unregister("zotero-pin-items-unpin");
	}

	addOverlayStyleSheet() {
		// todo: it should be possible to just import this and have esbuild work it out
		// but I couldn't get that to work, so add the CSS manually.
		const link = window.document.createElement("link");
		link.id = `${config.addonRef}-overlay-stylesheet`;
		link.rel = "stylesheet";
		link.href = `chrome://${config.addonRef}/content/skin/default/overlay.css`;
		window.document.documentElement.appendChild(link);
	}

	addPreferencesMenu() {
		const prefOptions = {
			pluginID: config.addonID,
			src: rootURI + "chrome/content/preferences.xhtml",
			label: getString("pref-title"),
			image: `chrome://${config.addonRef}/content/icons/favicon.png`,
			defaultXUL: true,
		};
		void Zotero.PreferencePanes.register(prefOptions);
	}

	removePreferencesMenu() {
		Zotero.PreferencePanes.unregister(config.addonID);
	}

	addPreferenceUpdateObservers() {
		this.preferenceUpdateObservers = [
			Zotero.Prefs.registerObserver(
				getPrefGlobalName(PREF_SORT_ORDER),
				(value: string) => {
					this.removePinItemsColumn();
					this.addPinItemsColumn();
				},
				true,
			),
			Zotero.Prefs.registerObserver(
				getPrefGlobalName(PREF_SORT_ORDER_FILES),
				(value: string) => {
					this.removePinItemsColumn();
					this.addPinItemsColumn();
				},
				true,
			),
		];
	}

	removePreferenceUpdateObservers() {
		if (this.preferenceUpdateObservers) {
			for (const preferenceUpdateObserverSymbol of this
				.preferenceUpdateObservers) {
				Zotero.Prefs.unregisterObserver(preferenceUpdateObserverSymbol);
			}
			this.preferenceUpdateObservers = undefined;
		}
	}
}
