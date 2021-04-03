import { APIGatewayEvent, Context } from "aws-lambda";
import axios from "axios";

export const BANOSHI = BigInt("1000000000000000000000000000");

interface RPCResponse {
	balance: string;
	pending: string;
}

interface Response {
	statusCode: number;
	headers?: { [header: string]: string | number };
	body: string;
}

interface BotAccount {
	account: string;
	name: string;
}

async function fetchBalance(account: string): Promise<number> {
	const response = await axios.post<RPCResponse>(
		"https://api-beta.banano.cc",
		{ action: "account_balance", account },
		{ responseType: "json" }
	);

	return Number(BigInt(response?.data?.balance) / BANOSHI) / 100;
}

async function fetchAccountsData(): Promise<BotAccount[]> {
	const { data } = await axios.get<BotAccount[]>(process.env.ACCOUNTS_URL, { responseType: "json" });
	return data;
}

async function getUsers(): Promise<string[]> {
	const accounts: BotAccount[] = await fetchAccountsData();

	return accounts.map(u => `#${u.name.split("#").pop()}`).sort();
}

export async function handler(event: APIGatewayEvent, context: Context): Promise<Response> {
	const command = event?.queryStringParameters?.command;

	if (command === "get_users") {
		return {
			statusCode: 200,
			headers: {
				"Content-Type": "application/json; charset=UTF-8",
				"Pragma": "public",
			},
			body: JSON.stringify({ users: await getUsers() }),
		};
	}

	if (command === "get_balance") {
		const accounts: BotAccount[] = await fetchAccountsData();
		const discordId = event?.queryStringParameters?.account;

		const filtered = accounts.filter(ba => ba.name.indexOf(`#${discordId}`) > 0);

		if (filtered.length) {
			const chosen = filtered[0];
			return {
				statusCode: 200,
				headers: {
					"Content-Type": "application/json; charset=UTF-8",
					"Pragma": "public",
				},
				body: JSON.stringify({ balance: await fetchBalance(chosen.account) }),
			};
		}

		return {
			statusCode: 404,
			headers: {
				"Content-Type": "application/json; charset=UTF-8",
			},
			body: JSON.stringify({ error: "no account found" }),
		};
	}

	return {
		statusCode: 400,
		headers: {
			"Content-Type": "application/json; charset=UTF-8",
		},
		body: JSON.stringify({ error: "unrecognized command" }),
	};
}
