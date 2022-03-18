export type APIResponse = {
	error?: string;
};

export type HistoryData = {
	type: "send" | "receive";
	account: string;
	amount: string;
	height: string;
	hash: string;
	local_timestamp: string;
};

export type HistoryCallRequest = {
	action: "account_history";
	account: string;
	count: number;
	head?: string;
};

export interface HistoryCallResponse extends APIResponse {
	account?: string;
	history?: HistoryData[];
	previous?: string;
}

export type InfoCallRequest = {
	action: "account_info";
	account: string;
};

export interface InfoCallResponse extends APIResponse {
	frontier: string;
	open_block: string;
	representative_block: string;
	balance: string;
	modified_timestamp: string;
	block_count: string;
	account_version: string;
	confirmation_height: string;
	confirmation_height_frontier: string;
}

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

export interface PriceCacheItem {
	data: CoinGeckoAPIResponse;
	timestamp: number;
}
