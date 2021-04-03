import async from "async";
import "../style/botwatch.less";

interface APIResponse {
	users?: string[];
	name?: string;
	balance?: number;
	error?: string;
}

interface CoinGeckoAPIResponse {
	banano: {
		usd: number;
	};
}

class Visualizer {
	users: string[];
	price: number;

	constructor() {
		this.init();
	}

	async init(): Promise<void> {
		this.users = await this.getKnownUsers();
		this.price = await this.fetchBananoPrice();
		this.populateUsers();
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
		async.eachLimit(userElems, 4, async ({ user, elem }) => {
			await this.fetchUserBalance(user, elem);
		});
	}

	async fetchBananoPrice(): Promise<number> {
		try {
			const response = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=Banano&vs_currencies=usd", {
				headers: {
					"accept": "application/json, text/javascript",
					"sec-fetch-dest": "empty",
					"sec-fetch-mode": "cors",
					"sec-fetch-site": "cross-site",
				},
				body: null,
				method: "GET",
				mode: "cors",
				credentials: "omit",
			});

			const data: CoinGeckoAPIResponse = await response.json();

			return data?.banano?.usd;
		} catch (error) {
			return null;
		}
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
		}
	}
}

window.addEventListener("load", () => new Visualizer());
