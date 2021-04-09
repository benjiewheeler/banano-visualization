import async from "async";
import "../style/botwatch.less";
import { AUTHOR_WALLET } from "./constants";
import { fetchBananoPrice, setClipboard } from "./utils";

interface APIResponse {
	users?: string[];
	name?: string;
	balance?: number;
	error?: string;
}

class Visualizer {
	users: string[];
	price: number;
	walletLink: HTMLAnchorElement;

	constructor() {
		this.walletLink = document.querySelector(".wallet-link");

		this.walletLink.addEventListener("click", () => setClipboard(AUTHOR_WALLET));

		this.init();
	}

	async init(): Promise<void> {
		document.querySelector(".main").classList.add("loading");
		this.users = await this.getKnownUsers();
		await this.getBananoPrice();
		this.populateUsers();
	}

	async getBananoPrice(): Promise<void> {
		const price = await fetchBananoPrice();
		if (price) this.price = price;
		else await this.getBananoPrice();
	}

	populateUsers(): void {
		const userElems = this.users?.map(user => {
			const elem = document.createElement("div");

			elem.classList.add("user");
			elem.innerHTML += `<span class="name">${user}</span>`;
			elem.innerHTML += `<div class="balance loading"></div>`;
			elem.querySelector(".balance").innerHTML += `<span class="ban"></span>`;
			elem.querySelector(".balance").innerHTML += `<span class="usd"></span>`;
			document.querySelector(".main").appendChild(elem);
			return { user, elem };
		});
		document.querySelector(".main").classList.remove("loading");
		async.eachLimit(userElems, 4, async ({ user, elem }) => {
			await this.fetchUserBalance(user, elem);
		});
	}

	async getKnownUsers(): Promise<string[]> {
		try {
			const response = await fetch("/api?command=get_users", {
				headers: { "content-type": "application/json" },
				body: null,
				method: "GET",
				mode: "cors",
				credentials: "omit",
			});

			const data: APIResponse = await response.json();

			return data?.users;
		} catch (error) {
			return null;
		}
	}

	async fetchUserBalance(user: string, elem: HTMLElement): Promise<void> {
		const balanceElem: HTMLElement = elem.querySelector(".balance");
		const banElem: HTMLElement = balanceElem.querySelector(".ban");
		const usdElem: HTMLElement = balanceElem.querySelector(".usd");

		try {
			balanceElem.classList.add("loading");
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			const [_, account] = user.split("#");
			const response = await fetch(`/api?command=get_balance&account=${account}`, {
				headers: { "content-type": "application/json" },
				body: null,
				method: "GET",
				mode: "cors",
				credentials: "omit",
			});

			const data: APIResponse = await response.json();

			balanceElem.classList.remove("loading");
			banElem.innerText = data.balance.toLocaleString("en", { style: "currency", currency: "BAN" });
			usdElem.innerText = (this.price * data.balance).toLocaleString("en", { style: "currency", currency: "USD" });
		} catch (error) {
			balanceElem.classList.remove("loading");
			balanceElem.classList.add("failure");
			balanceElem.innerText = "Failure";

			setTimeout(() => this.fetchUserBalance(user, elem), 5000);
		}
	}
}

window.addEventListener("load", () => new Visualizer());
