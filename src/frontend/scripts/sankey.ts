/* eslint-disable @typescript-eslint/ban-ts-comment */
import * as d3 from "d3";
import * as d3Sankey from "d3-sankey";
import _ from "lodash";
import "../style/sankey.less";
import { AUTHOR_WALLET, BANOSHI } from "./constants";
import { APIResponse, HistoryCallResponse, LoaderConfig } from "./types";
import { URLHashManager } from "./URLHashManager";
import { sendRPCCall, setClipboard, abbreviateAccount } from "./utils";

export interface D3Node extends d3Sankey.SankeyNodeMinimal<D3Node, D3Link> {
	account: string;
	id: string;
}

export interface D3Link extends d3Sankey.SankeyLinkMinimal<D3Node, D3Link> {
	source: string;
	target: string;
	value: number;
}

class Visualizer {
	hashManager: URLHashManager;
	inputElem: HTMLInputElement;
	submitBtn: HTMLInputElement;
	copyBtn: HTMLInputElement;
	svgElem: SVGElement;
	errorElem: HTMLSpanElement;
	walletLink: HTMLAnchorElement;

	constructor() {
		this.hashManager = new URLHashManager();

		this.inputElem = document.querySelector(".account-input");
		this.submitBtn = document.querySelector(".account-submit");
		this.copyBtn = document.querySelector(".copy-btn");
		this.svgElem = document.querySelector(".d3-svg");
		this.errorElem = document.querySelector(".error .message");
		this.walletLink = document.querySelector(".wallet-link");

		window.addEventListener("resize", () => this.resizeCanvas());

		this.inputElem.addEventListener("keypress", e => {
			if (e.key === "Enter") {
				this.submitBtn.click();
			}
		});
		this.submitBtn.addEventListener("click", () => this.hashManager.setHashParam(URLHashManager.ACCOUNT_PARAM, this.inputElem.value));
		this.copyBtn.addEventListener("click", () => setClipboard(location.href));
		this.walletLink.addEventListener("click", () => setClipboard(AUTHOR_WALLET));

		// @ts-ignore
		addEventListener(URLHashManager.ACCOUNT_CHANGE_EVENT, (e: CustomEvent<string>) => {
			this.selectAccount(e.detail);
		});

		const account = this.hashManager.getHashParam(URLHashManager.ACCOUNT_PARAM);

		if (account) {
			this.selectAccount(account);
		}
	}

	resizeCanvas(): void {
		this.svgElem.parentElement.classList.add("fullsize");
		this.svgElem.setAttribute("width", `${this.svgElem.parentElement.clientWidth}px`);
		this.svgElem.setAttribute("height", `${this.svgElem.parentElement.clientHeight}px`);

		// @ts-ignore
		d3.select(this.svgElem).attr("viewBox", [
			// -this.svgElem.clientWidth / 2,
			// -this.svgElem.clientHeight / 2,
			0,
			0,
			this.svgElem.clientWidth,
			this.svgElem.clientHeight,
		]);
	}

	clearError(): void {
		this.errorElem.innerText = "";
	}

	handleError(error: string): void {
		this.errorElem.innerText = error;
	}

	async selectAccount(account: string): Promise<void> {
		this.inputElem.value = account;
		await this.getAccountHistory(account);
	}

	async getAccountHistory(account: string): Promise<void> {
		this.clearError();
		this.copyBtn.classList.remove("visible");
		this.drawLoader({ width: 100, height: 100 });

		try {
			const data: HistoryCallResponse = await sendRPCCall({ action: "account_history", account, count: 100 });
			if (data.error) {
				this.clearCanvas();
				this.handleError(data.error);
				return;
			}
			if (!Array.isArray(data.history)) {
				throw new Error("history is not an array");
			}

			this.copyBtn.classList.add("visible");
			this.drawTransactions(account, data);
		} catch (error) {
			this.clearCanvas();
			this.handleError("Failed to load transaction history");
		}
	}

	getNodes(data: HistoryCallResponse): D3Node[] {
		const output: D3Node[] = _(data.history)
			.groupBy(tx => tx.type)
			.mapValues((transactions, type) =>
				_(transactions)
					.groupBy(tx => tx.account)
					.filter(transactions => _(transactions).sumBy(tx => Number(BigInt(tx.amount) / BANOSHI)) > 0)
					.flatten()
					.groupBy(tx => tx.account)
					.mapValues((_transactions, account) => ({ account, id: `${type}:${account}` }))
					.mapKeys((_transactions, account) => `${type}:${account}`)
					.values()
					.value()
			)
			.values()
			.flatten()
			.value();

		return [{ account: data.account, id: data.account }, ...output];
	}

	getLinks(data: HistoryCallResponse): D3Link[] {
		return _(data.history)
			.groupBy(tx => tx.type)
			.mapValues((transactions, type) =>
				_(transactions)
					.groupBy(tx => tx.account)
					.mapKeys((_transactions, account) => `${type}:${account}`)
					.mapValues<D3Link>((transactions, account) => ({
						source: type == "send" ? data.account : account,
						target: type == "receive" ? data.account : account,
						value: _(transactions).sumBy(tx => Number(BigInt(tx.amount) / BANOSHI)),
					}))
					.filter(tx => tx.value > 0)
					.value()
			)
			.values()
			.flatten()
			.value();
	}

	clearCanvas(): void {
		d3.select(this.svgElem).selectAll("*").remove();
	}

	drawLoader(config: LoaderConfig): void {
		const svg = d3.select(this.svgElem);
		this.clearCanvas();
		this.resizeCanvas();

		const radius = Math.min(config.width, config.height) / 2;
		const tau = 2 * Math.PI;

		const arc = d3
			.arc()
			.innerRadius(radius * 0.5)
			.outerRadius(radius * 0.9)
			.startAngle(0);

		svg.append("g")
			.attr("transform", `translate(${this.svgElem.clientWidth / 2} ${this.svgElem.clientHeight / 4})`)
			.append("path")
			.datum({ endAngle: 0.33 * tau })
			.style("fill", "#4D4D4D")
			// @ts-ignore
			.attr("d", arc)
			// @ts-ignore
			.call(spin, 1500);

		function spin(selection: d3.Selection<SVGPathElement, unknown, null, unknown>, duration: number) {
			selection
				.transition()
				.ease(t => t * t)
				.duration(duration)
				.attrTween("transform", () => d3.interpolateString("rotate(0)", "rotate(360)"));

			setTimeout(() => spin(selection, duration), duration);
		}
	}

	drawTransactions(selfAccount: string, data: APIResponse): void {
		const svg = d3.select(this.svgElem);
		this.resizeCanvas();
		this.clearCanvas();

		const graph = {
			links: this.getLinks(data),
			nodes: this.getNodes(data),
		};
		console.log(graph);

		if (graph.nodes.length > 100) {
			const goAhead = confirm(
				"Too many transaction (" + graph.nodes.length + " other wallets)\nmight cause a potassium overdose :(\nWanna continue ?"
			);
			if (!goAhead) return;
		}

		const sankey = d3Sankey
			.sankey<d3Sankey.SankeyGraph<D3Node, D3Link>, D3Node, D3Link>()
			.nodeId(d => d.id)
			.nodeAlign(d3Sankey.sankeyJustify)
			.nodeWidth(15)
			.nodePadding(8)
			.extent([
				[5, 10],
				[this.svgElem.clientWidth - 5, this.svgElem.clientHeight - 10],
			]);

		const sankeyData = sankey({
			nodes: graph.nodes.map(d => Object.assign({}, d)),
			links: graph.links.map(d => Object.assign({}, d)),
		});
		const color = d3.scaleOrdinal(d3.schemeCategory10);

		svg.append("g")
			.selectAll("rect")
			.data(sankeyData.nodes)
			.join("rect")
			.attr("x", d => d.x0)
			.attr("y", d => d.y0)
			.attr("height", d => Math.max(1, d.y1 - d.y0))
			.attr("width", d => d.x1 - d.x0)
			.attr("fill", d => color(d.account))
			.attr("class", "node")
			.attr("title", d => d.account)
			.on("dblclick", (e, n: D3Node) => this.hashManager.setHashParam(URLHashManager.ACCOUNT_PARAM, graph.nodes[n.index].account));

		const link = svg.append("g").attr("fill", "none").selectAll("g").data(sankeyData.links).join("g");

		link.append("path")
			.attr("class", "link")
			.attr("d", d3Sankey.sankeyLinkHorizontal())
			.attr("stroke-width", d => Math.max(1, d.width));

		svg.append("g")
			.attr("font-family", "sans-serif")
			.attr("font-size", 13)
			.attr("fill", "#d2d2d0")
			.selectAll("text")
			.data(sankeyData.nodes)
			.join("text")
			.attr("x", d => (d.x0 < this.svgElem.clientWidth / 2 ? d.x1 + 6 : d.x0 - 6))
			.attr("y", d => (d.y1 + d.y0) / 2)
			.attr("dy", "0.35em")
			.attr("text-anchor", d => (d.x0 < this.svgElem.clientWidth / 2 ? "start" : "end"))
			.text(d => (d.account === selfAccount ? "Me" : abbreviateAccount(d.account)));
	}
}

window.addEventListener("load", () => new Visualizer());
