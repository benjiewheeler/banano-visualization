import _ from "lodash";
import "../style/burn.less";
import { AUTHOR_WALLET, BANOSHI, BURN_WALLET } from "./constants";
import { APIResponse } from "./types";
import { URLHashManager } from "./URLHashManager";
import { fetchAccountHistory, fetchBananoPrice, setClipboard } from "./utils";

class Visualizer {
	hashManager: URLHashManager;
	inputElem: HTMLInputElement;
	submitBtn: HTMLInputElement;
	copyBtn: HTMLInputElement;
	mainElem: HTMLElement;
	errorElem: HTMLSpanElement;
	walletLink: HTMLAnchorElement;
	price: number;

	constructor() {
		this.hashManager = new URLHashManager();

		this.inputElem = document.querySelector(".account-input");
		this.submitBtn = document.querySelector(".account-submit");
		this.copyBtn = document.querySelector(".copy-btn");
		this.mainElem = document.querySelector(".main");
		this.errorElem = document.querySelector(".error .message");
		this.walletLink = document.querySelector(".wallet-link");

		this.inputElem.addEventListener("keypress", e => {
			if (e.key === "Enter") {
				this.submitBtn.click();
			}
		});
		this.submitBtn.addEventListener("click", () => this.hashManager.setHashParam(URLHashManager.ACCOUNT_PARAM, this.inputElem.value));
		this.copyBtn.addEventListener("click", () => setClipboard(location.href));
		this.walletLink.addEventListener("click", () => setClipboard(AUTHOR_WALLET));

		addEventListener(URLHashManager.ACCOUNT_CHANGE_EVENT, (e: CustomEvent<string>) => this.selectAccount(e.detail));

		const account = this.hashManager.getHashParam(URLHashManager.ACCOUNT_PARAM);

		if (account) {
			this.selectAccount(account);
		}
	}

	clearError(): void {
		this.errorElem.innerText = "";
	}

	handleError(error: string): void {
		this.errorElem.innerText = error;
	}

	async selectAccount(account: string): Promise<void> {
		if (!this.price) {
			this.price = await fetchBananoPrice();
		}

		this.inputElem.value = account;
		await this.getAccountHistory(account);
	}

	async getAccountHistory(account: string): Promise<void> {
		this.clearError();
		this.copyBtn.classList.remove("visible");
		this.mainElem.classList.add("loading");

		try {
			const data: APIResponse = await fetchAccountHistory(account);
			if (data.error) {
				this.handleError(data.error);
				return;
			}
			if (!Array.isArray(data.history)) {
				throw new Error("history is not an array");
			}

			this.copyBtn.classList.add("visible");
			this.mainElem.classList.remove("loading");
			this.calculateBurn(data);
		} catch (error) {
			this.handleError("Failed to load transaction history");
		}
	}

	calculateBurn(data: APIResponse): void {
		const banElem: HTMLElement = this.mainElem.querySelector(".ban");
		const usdElem: HTMLElement = this.mainElem.querySelector(".usd");

		const burnAmount = _(data.history)
			.filter(tx => tx.account === BURN_WALLET)
			.map(tx => Number(BigInt(tx.amount) / BANOSHI) / 100)
			.sum();

		banElem.innerText = burnAmount.toLocaleString("en", { style: "currency", currency: "BAN" });
		usdElem.innerText = (this.price * burnAmount).toLocaleString("en", { style: "currency", currency: "USD" });
	}
}

window.addEventListener("load", () => new Visualizer());
