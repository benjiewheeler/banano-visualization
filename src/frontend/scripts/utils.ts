import { CACHE_THRESHOLD } from "./constants";
import { APIResponse, CacheItem } from "./types";

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
		const response = await fetch("https://kaliumapi.appditto.com/api", {
			headers: {
				"content-type": "application/json",
				"sec-fetch-dest": "empty",
				"sec-fetch-mode": "cors",
				"sec-fetch-site": "cross-site",
			},
			body: JSON.stringify({ action: "account_history", account, count: 1000, raw: false }),
			method: "POST",
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
