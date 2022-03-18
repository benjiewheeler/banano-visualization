import Dexie from "dexie";
import _ from "lodash";
import "../style/stats.less";
import { AUTHOR_WALLET, BANOSHI } from "./constants";
import { HistoryCallResponse } from "./types";
import { URLHashManager } from "./URLHashManager";
import { formatBANCurrency, sendRPCCall, setClipboard } from "./utils";

interface Account {
	id?: number;
	address: string;
}

interface Transaction {
	hash: string;
	from: string;
	to: string;
	amount: number;
	date: Date;
	height: number;
}

class BananoDB extends Dexie {
	accounts: Dexie.Table<Account, number>;
	transactions: Dexie.Table<Transaction, number>;

	constructor() {
		super("bandb");

		this.version(2).stores({
			accounts: "++id,address",
			transactions: "hash,from,to,amount,date,height",
		});

		this.accounts = this.table("accounts");
		this.transactions = this.table("transactions");
	}
}

class Visualizer {
	db: BananoDB;
	account?: string;
	hashManager: URLHashManager;
	inputElem: HTMLInputElement;
	submitBtn: HTMLInputElement;
	copyBtn: HTMLInputElement;
	errorElem: HTMLSpanElement;
	walletLink: HTMLAnchorElement;

	constructor() {
		this.hashManager = new URLHashManager();

		this.inputElem = document.querySelector(".account-input");
		this.submitBtn = document.querySelector(".account-submit");
		this.copyBtn = document.querySelector(".copy-btn");
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

		// eslint-disable-next-line @typescript-eslint/ban-ts-comment
		//@ts-ignore
		addEventListener(URLHashManager.ACCOUNT_CHANGE_EVENT, (e: CustomEvent<string>) => {
			if (e.detail) this.selectAccount(e.detail);
		});

		this.init();

		const account = this.hashManager.getHashParam(URLHashManager.ACCOUNT_PARAM);

		if (account) {
			this.selectAccount(account);
		}
	}

	async init(): Promise<void> {
		this.db = new BananoDB();
	}

	async selectAccount(account: string): Promise<void> {
		this.inputElem.value = account;
		this.clearError();
		this.copyBtn.classList.remove("visible");
		document.querySelector(".main").classList.add("loading");

		await this.getAccountHistory(account);
	}

	clearError(): void {
		this.errorElem.innerText = "";
	}

	handleError(error: string): void {
		this.errorElem.innerText = error;
	}

	async getAccountHistory(account: string): Promise<void> {
		try {
			const data: HistoryCallResponse = await sendRPCCall({ action: "account_history", account, count: 1000 });
			if (data.error) {
				this.handleError(data.error);
				return;
			}

			if (!Array.isArray(data.history)) {
				throw new Error("history is not an array");
			}

			this.copyBtn.classList.add("visible");
			this.account = account;
			await this.saveTransactions(data);
			await this.populateStats();
			document.querySelector(".main").classList.remove("loading");
		} catch (error) {
			this.handleError("Failed to load transaction history");
		}
	}

	async saveTransactions(data: HistoryCallResponse) {
		await this.db.transactions.bulkPut(
			data.history.map<Transaction>(tx => ({
				amount: Number(BigInt(tx.amount) / BANOSHI) / 100,
				date: new Date(parseInt(tx.local_timestamp, 10) * 1e3),
				from: tx.type == "send" ? data.account : tx.account,
				to: tx.type == "receive" ? data.account : tx.account,
				hash: tx.hash,
				height: parseInt(tx.height, 10),
			}))
		);
	}

	async populateStats() {
		const txs = await this.db.transactions.filter(tx => tx.from === this.account || tx.to === this.account).sortBy("date");
		const totalReceive = _(txs)
			.filter(tx => tx.to === this.account)
			.sumBy(tx => tx.amount);
		const totalSend = _(txs)
			.filter(tx => tx.from === this.account)
			.sumBy(tx => tx.amount);

		const topReceiver = _(txs)
			.filter(tx => tx.from === this.account)
			.groupBy(tx => tx.to)
			.mapValues(v => _(v).sumBy("amount"))
			.toPairs()
			.orderBy([1], ["desc"])
			.first();

		const topSender = _(txs)
			.filter(tx => tx.to === this.account)
			.groupBy(tx => tx.from)
			.mapValues(v => _(v).sumBy("amount"))
			.toPairs()
			.orderBy([1], ["desc"])
			.first();

		document.querySelector<HTMLSpanElement>(".send .total .value").innerText = formatBANCurrency(totalSend);
		document.querySelector<HTMLSpanElement>(".receive .total .value").innerText = formatBANCurrency(totalReceive);

		document.querySelector<HTMLSpanElement>(".send .top .value").innerText = `${topReceiver[0]} (${formatBANCurrency(topReceiver[1])})`;
		document.querySelector<HTMLSpanElement>(".receive .top .value").innerText = `${topSender[0]} (${formatBANCurrency(topSender[1])})`;
	}
}

window.addEventListener("load", () => new Visualizer());
