import { APIGatewayEvent, Context } from "aws-lambda";
import axios from "axios";
import { promises as fs } from "fs";
import path from "path";

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

async function getUsers(): Promise<string[]> {
	const accounts: BotAccount[] = JSON.parse(await fs.readFile(path.resolve(__dirname, "../accounts.json"), "utf-8"));

	return accounts.map(u => `#${u.name.split("#").pop()}`).sort();
}

export async function handler(event: APIGatewayEvent, context: Context): Promise<Response> {
	const accounts: BotAccount[] = JSON.parse(await fs.readFile(path.resolve(__dirname, "../accounts.json"), "utf-8"));

	const command = event?.queryStringParameters?.command;

	if (command === "get_users") {
		return {
			statusCode: 200,
			headers: {
				"Content-Type": "application/json; charset=UTF-8",
				"Pragma": "public",
				"Cache-Control": "public; max-age=3600",
			},
			body: JSON.stringify({ users: await getUsers() }),
		};
	}

	if (command === "get_balance") {
		const discordId = event?.queryStringParameters?.account;

		const filtered = accounts.filter(ba => ba.name.indexOf(`#${discordId}`) > 0);

		if (filtered.length) {
			const chosen = filtered[0];
			return {
				statusCode: 200,
				headers: {
					"Content-Type": "application/json; charset=UTF-8",
					"Pragma": "public",
					"Cache-Control": "max-age=900",
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
