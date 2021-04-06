import { APIGatewayEvent } from "aws-lambda";
import axios from "axios";
import _ from "lodash";

const DEFAULT_COUNT = 1000;
const MAX_COUNT = 5000;

interface HistoryQueryParams {
	action?: "account_history";
	account?: string;
	count?: string;
}

export type HistoryData = {
	type: "send" | "receive";
	account: string;
	amount: string;
	hash: string;
	height: string;
	local_timestamp: string;
};

interface RPCResponse {
	account?: string;
	history?: HistoryData[];
	error?: string;
}

interface Response {
	statusCode: number;
	headers?: { [header: string]: string | number };
	body: string;
}

async function fetchHistory(account: string, offset = 0): Promise<Partial<HistoryData>[]> {
	const response = await axios.post<RPCResponse>(
		"https://kaliumapi.appditto.com/api",
		{ action: "account_history", account, count: 1000, offset },
		{ responseType: "json" }
	);

	return _(response?.data?.history)
		.map(tx => _(tx).omit("hash", "height", "local_timestamp").value())
		.value();
}

export async function handler(event: APIGatewayEvent): Promise<Response> {
	const queryParams: HistoryQueryParams = { ...event?.queryStringParameters };

	const action = queryParams?.action;
	const account = queryParams?.account;
	const count = Math.min(parseInt(queryParams?.count, 10) || DEFAULT_COUNT, MAX_COUNT);

	if (!account) {
		return {
			statusCode: 400,
			headers: { "Content-Type": "application/json; charset=UTF-8" },
			body: JSON.stringify({ error: "account param required" }),
		};
	}

	if (action === "account_history") {
		const history: Partial<HistoryData>[] = [];

		const offsets = _.range(0, count, DEFAULT_COUNT);

		for (let i = 0; i < offsets.length; i++) {
			const offset = offsets[i];
			const page = await fetchHistory(account, offset);
			page.forEach(tx => history.push(tx));
			if (page.length < DEFAULT_COUNT) {
				break;
			}
		}

		return {
			statusCode: 200,
			headers: {
				"Content-Type": "application/json; charset=UTF-8",
				"Pragma": "public",
			},
			body: JSON.stringify({ account, history }),
		};
	}

	return {
		statusCode: 400,
		headers: {
			"Content-Type": "application/json; charset=UTF-8",
		},
		body: JSON.stringify({ error: "unrecognized action" }),
	};
}
