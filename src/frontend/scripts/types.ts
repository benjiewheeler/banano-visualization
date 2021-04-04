export type HistoryData = {
	type: "send" | "receive";
	account: string;
	amount: string;
};

export type APIResponse = {
	account?: string;
	history?: HistoryData[];
	error?: string;
};

export interface CacheItem {
	data: APIResponse;
	timestamp: number;
}

export interface LoaderConfig {
	width: number;
	height: number;
}

export interface HashParams {
	account?: string;
	[key: string]: string | number | (string | number)[];
}

export interface CoinGeckoAPIResponse {
	banano: {
		usd: number;
	};
}
