import { config } from "../../package.json";
import { getString } from "../utils/locale";
import {
	getItemExtraProperty,
	setItemExtraProperty,
	clearItemExtraProperty,
} from "../utils/extraField";

const PIN_ITEMS_COLUMN_ID = "pinitems";
const PINNED_EXTRA_FIELD = "Pinned_Collections";

export default class ZoteroPinItems {
	pinItemsColumnId?: string | false;
	preferenceUpdateObservers?: symbol[];

	constructor() {
		void this.addPinItemsColumn();
		this.addRightClickMenuItems();
		this.addOverlayStyleSheet();
	}

	public unload() {
		void this.removePinItemsColumn();
		this.removeRightClickMenuItems();
	}

	async addPinItemsColumn() {
		this.pinItemsColumnId = await Zotero.ItemTreeManager.registerColumns({
			dataKey: PIN_ITEMS_COLUMN_ID,
			// If we just want to show the icon, overwrite the label with htmlLabel (#1)
			htmlLabel: `<span xmlns="http://www.w3.org/1999/xhtml" class="icon icon-css icon-16" style="background: url(chrome://zotero/skin/16/universal/pin.svg) content-box no-repeat center/contain; fill: var(--fill-secondary); -moz-context-properties: fill;" />`,
			iconPath: "chrome://zotero/skin/16/universal/pin.svg", // this hides the sorting arrow
			label: getString("pinitems-column-name"),
			pluginID: config.addonID,
			dataProvider: (item: Zotero.Item, dataKey: string) => {
				return item.isRegularItem()
					? this.isItemPinned(item).toString()
					: "";
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
				if (data === "true") {
					const icon = this.createSpanElement("icon icon-css", "");
					icon.style.cssText +=
						"background: url(chrome://zotero/skin/16/universal/pin.svg) content-box no-repeat center/contain; fill: var(--fill-secondary); -moz-context-properties: fill; width: 12px; height: 12px; padding: 1px; box-sizing: content-box;";
					cell.append(icon);
				}

				return cell;
			},
			fixedWidth: true,
			// staticWidth: true,
			width: 32,
			zoteroPersist: ["width", "hidden", "sortDirection"],
		});
	}

	createSpanElement(className: string, innerText: string) {
		const span = document.createElementNS(
			"http://www.w3.org/1999/xhtml",
			"span",
		);
		span.className = className;
		span.innerText = innerText;
		return span;
	}

	async removePinItemsColumn() {
		if (this.pinItemsColumnId) {
			await Zotero.ItemTreeManager.unregisterColumns(
				this.pinItemsColumnId,
			);
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
			ZoteroPane.getSelectedCollection()?.key as string,
		);
	}

	pinItem(item: Zotero.Item) {
		const pinnedCollections = this.getItemPinnedCollections(item);
		const currentCollection = ZoteroPane.getSelectedCollection()
			?.key as string;
		if (!pinnedCollections.includes(currentCollection)) {
			pinnedCollections.push(currentCollection);
			this.setItemPinnedCollections(item, pinnedCollections);
			void item.saveTx();
		}
	}

	unpinItem(item: Zotero.Item) {
		const pinnedCollections = this.getItemPinnedCollections(item);
		const currentCollection = ZoteroPane.getSelectedCollection()
			?.key as string;
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
}
