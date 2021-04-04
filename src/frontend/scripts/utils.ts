import { CACHE_THRESHOLD, PRICE_STORAGE_KEY } from "./constants";
import { APIResponse, CacheItem, CoinGeckoAPIResponse, PriceCacheItem } from "./types";

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

export function saveResponse(data: APIResponse): void {
	const cacheItem: CacheItem = { data, timestamp: Date.now() };
	localStorage.setItem(data.account, JSON.stringify(cacheItem));
}

export function retrieveCache(account: string): CacheItem {
	const savedData = localStorage.getItem(account);
	if (savedData) {
		const cacheItem: CacheItem = JSON.parse(savedData);
		if (Date.now() - cacheItem.timestamp < CACHE_THRESHOLD) {
			return cacheItem;
		}
	}
	return null;
}

export async function fetchAccountHistory(account: string): Promise<APIResponse> {
	const cacheItem = retrieveCache(account);
	if (cacheItem) {
		return cacheItem.data;
	}

	try {
		const url = new URL(location.href);
		url.hash = null;
		url.search = "";
		url.pathname = "/node";
		url.searchParams.append("action", "account_history");
		url.searchParams.append("account", account);
		url.searchParams.append("count", "2000");

		const response = await fetch(url.toString(), {
			headers: {
				"content-type": "application/json",
				"sec-fetch-dest": "empty",
				"sec-fetch-mode": "cors",
				"sec-fetch-site": "cross-site",
			},
			body: null,
			method: "GET",
			mode: "cors",
			credentials: "omit",
		});

		const data: APIResponse = await response.json();
		saveResponse(data);
		return data;
	} catch (error) {
		return { error: "Failed to load transaction history" };
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
