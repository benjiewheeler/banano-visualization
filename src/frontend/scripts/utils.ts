import { CACHE_THRESHOLD, PRICE_STORAGE_KEY, PUBLIC_NODES } from "./constants";
import { APIResponse, CoinGeckoAPIResponse, HistoryCallRequest, InfoCallRequest, InfoCallResponse, PriceCacheItem } from "./types";

export function setClipboard(value: string): void {
	const elem = document.createElement("input");
	elem.classList.add("copy-elem");
	elem.value = value;
	document.body.appendChild(elem);
	elem.select();
	document.execCommand("copy");
	document.body.removeChild(elem);
}

export function abbreviateAccount(account: string): string {
	const prefix = account.substring(0, 9);
	const suffix = account.substring(account.length - 5, account.length);

	return `${prefix}...${suffix}`;
}

export async function sendRPCCall(payload: HistoryCallRequest): Promise<InfoCallResponse>;
export async function sendRPCCall(payload: InfoCallRequest): Promise<InfoCallResponse>;
export async function sendRPCCall(payload: unknown): Promise<APIResponse> {
	return makeRPCCall(payload);
}

async function makeRPCCall(payload: unknown, index = 0): Promise<APIResponse> {
	if (index >= PUBLIC_NODES.length) {
		return { error: "Failed to load transaction history" };
	}

	const url = PUBLIC_NODES[index];

	try {
		const response = await fetch(url, {
			headers: {
				"content-type": "application/json",
				"sec-fetch-dest": "empty",
				"sec-fetch-mode": "cors",
				"sec-fetch-site": "cross-site",
			},
			body: JSON.stringify(payload),
			method: "POST",
			mode: "cors",
			credentials: "omit",
		});

		return await response.json();
	} catch (error) {
		return makeRPCCall(payload, index + 1);
	}
}

export async function fetchBananoPrice(): Promise<number> {
	const savedData = localStorage.getItem(PRICE_STORAGE_KEY);
	if (savedData) {
		const cacheItem: PriceCacheItem = JSON.parse(savedData);
		if (Date.now() - cacheItem.timestamp < CACHE_THRESHOLD) {
			return cacheItem?.data?.banano?.usd;
		}
	}

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

		const cacheItem: PriceCacheItem = { data, timestamp: Date.now() };
		localStorage.setItem(PRICE_STORAGE_KEY, JSON.stringify(cacheItem));

		return data?.banano?.usd;
	} catch (error) {
		return null;
	}
}

export function formatBANCurrency(amount: number): string {
	return amount.toLocaleString("en", { style: "currency", currency: "BAN" });
}
