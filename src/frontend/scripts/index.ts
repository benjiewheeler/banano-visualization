import "../style/index.less";
import { AUTHOR_WALLET } from "./constants";
import { setClipboard } from "./utils";

class Visualizer {
	walletLink: HTMLAnchorElement;

	constructor() {
		this.walletLink = document.querySelector(".wallet-link");

		this.walletLink.addEventListener("click", () => setClipboard(AUTHOR_WALLET));
	}
}

window.addEventListener("load", () => new Visualizer());
