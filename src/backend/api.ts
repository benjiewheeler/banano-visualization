import { APIGatewayEvent, Context } from "aws-lambda";

interface Response {
	statusCode: number;
	headers?: { [header: string]: string };
	body: string;
}

export async function handler(event: APIGatewayEvent, context: Context): Promise<Response> {
	return {
		statusCode: 200,
		body: JSON.stringify({ event, context }),
	};
}
