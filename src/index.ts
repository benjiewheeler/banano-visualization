/* eslint-disable @typescript-eslint/ban-ts-comment */
import * as d3 from "d3";
import { SimulationLinkDatum, SimulationNodeDatum } from "d3";
import _ from "lodash";
import qs from "querystring";
import "./index.less";

const CACHE_THRESHOLD = 1000 * 60 * 15; // 15 min
const BANOSHI = BigInt("1000000000000000000000000000");

type HistoryData = {
	account: string;
	amount: string;
};

type BananoData = {
	account: string;
	history: HistoryData[];
};

type ErrorResponse = {
	error: string;
};

interface D3Node extends SimulationNodeDatum {
	id: string;
}

interface D3Link extends SimulationLinkDatum<D3Node> {
	source: string;
	target: string;
	value: number;
}

interface CacheItem {
	data: BananoData;
	timestamp: number;
}

interface LoaderConfig {
	width: number;
	height: number;
}

interface HashParams {
	account?: string;
	[key: string]: string | number | (string | number)[];
}

class URLHashManager {
	public static ACCOUNT_CHANGE_EVENT = "account_changed";
	public static ACCOUNT_PARAM = "account";

	constructor() {
		window.addEventListener("hashchange", e => this.handleChange(e.oldURL, e.newURL));
	}

	private handleChange(oldURL: string, newURL: string, forceEvent = false): void {
		const fromData = this.readHash(new URL(oldURL).hash);
		const toData = this.readHash(new URL(newURL).hash);

		if (toData?.account !== fromData?.account || forceEvent) {
			dispatchEvent(new CustomEvent(URLHashManager.ACCOUNT_CHANGE_EVENT, { detail: toData?.account }));
		}
	}

	readHash(hash: string = location.hash): HashParams {
		if (!hash || !hash.length) return {};
		if (hash.charCodeAt(0) === 35) hash = hash.substr(1);
		const data = qs.parse(hash);
		return data;
	}

	getHashParam(name: string, hash: string = location.hash): string {
		if (hash.charCodeAt(0) === 35) hash = hash.substr(1);
		const data = qs.parse(hash);
		const value = data[name];
		console.log(name, hash, data, value);
		if (!value) return null;
		return value.toString();
	}

	setHashParam(name: string, value: string): void {
		let hash = location.hash;
		if (hash.charCodeAt(0) === 35) hash = hash.substr(1);
		const data = qs.parse(hash);
		data[name] = value;
		location.hash = qs.stringify(data);
		this.handleChange(location.hash, `#${qs.stringify(data)}`, true);
	}

	setHash(args: { [name: string]: string | number }): void {
		location.hash = qs.stringify(args);
	}
}

class Visualizer {
	hashManager: URLHashManager;
	inputElem: HTMLInputElement;
	submitBtn: HTMLInputElement;
	svgElem: SVGElement;
	errorElem: HTMLSpanElement;

	constructor() {
		this.hashManager = new URLHashManager();

		this.inputElem = document.querySelector(".account-input");
		this.submitBtn = document.querySelector(".account-submit");
		this.svgElem = document.querySelector(".d3-svg");
		this.errorElem = document.querySelector(".error .message");

		this.resizeCanvas();

		window.addEventListener("resize", () => this.resizeCanvas());

		this.inputElem.addEventListener("keypress", e => {
			if (e.key === "Enter") {
				this.submitBtn.click();
			}
		});
		this.submitBtn.addEventListener("click", () => this.hashManager.setHashParam(URLHashManager.ACCOUNT_PARAM, this.inputElem.value));

		addEventListener(URLHashManager.ACCOUNT_CHANGE_EVENT, (e: CustomEvent<string>) => this.selectAccount(e.detail));

		const account = this.hashManager.getHashParam(URLHashManager.ACCOUNT_PARAM);
		console.log(account);

		if (account) {
			this.selectAccount(account);
		}
	}

	resizeCanvas(): void {
		this.svgElem.setAttribute("width", `${this.svgElem.parentElement.clientWidth}px`);
		this.svgElem.setAttribute("height", `${this.svgElem.parentElement.clientHeight}px`);

		// @ts-ignore
		d3.select(this.svgElem).attr("viewBox", [
			-this.svgElem.clientWidth / 2,
			-this.svgElem.clientHeight / 2,
			this.svgElem.clientWidth,
			this.svgElem.clientHeight,
		]);
	}

	abbreviateAccount(account: string): string {
		const prefix = account.substring(0, 9);
		const suffix = account.substring(account.length - 5, account.length);

		return `${prefix}...${suffix}`;
	}

	saveResponse(data: BananoData): void {
		const cacheItem: CacheItem = { data, timestamp: Date.now() };
		localStorage.setItem(data.account, JSON.stringify(cacheItem));
	}

	retrieveCache(account: string): CacheItem {
		const savedData = localStorage.getItem(account);
		if (savedData) {
			const cacheItem: CacheItem = JSON.parse(savedData);
			if (Date.now() - cacheItem.timestamp < CACHE_THRESHOLD) {
				return cacheItem;
			}
		}
		return null;
	}

	clearError(): void {
		this.errorElem.innerText = "";
	}

	handleError(error: string): void {
		this.errorElem.innerText = error;
	}

	async selectAccount(account: string): Promise<void> {
		document.documentElement.scrollTop = this.svgElem.parentElement.offsetTop;

		this.inputElem.value = account;
		await this.fetchAccountHistory(account);
	}

	async fetchAccountHistory(account: string): Promise<void> {
		this.clearError();
		this.drawLoader({ width: 100, height: 100 });

		const cacheItem = this.retrieveCache(account);
		if (cacheItem) {
			this.drawTransactions(account, cacheItem.data);
			return;
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

			const data: BananoData & ErrorResponse = await response.json();
			if (data.error) {
				this.clearCanvas();
				this.handleError(data.error);
				return;
			}
			if (!Array.isArray(data.history)) {
				throw new Error("history is not an array");
			}

			this.saveResponse(data);
			this.drawTransactions(account, data);
		} catch (error) {
			this.clearCanvas();
			this.handleError("Failed to load transaction history");
		}
	}

	getNodes(data: BananoData): D3Node[] {
		const history = _(data.history)
			.map("account")
			.uniq()
			.map(id => ({ id }))
			.value();

		return [{ id: data.account }, ...history];
	}

	getLinks(data: BananoData): D3Link[] {
		const output: { [target: string]: D3Link } = {};

		data.history.forEach(tx => {
			if (!output[tx.account]) {
				output[tx.account] = { source: data.account, target: tx.account, value: 0 };
			}
			output[tx.account].value += Number(BigInt(tx.amount) / BANOSHI);
		});

		return _(output)
			.values()
			.filter(l => l.value > 0)
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

		svg.append("path")
			.datum({ endAngle: 0.33 * tau })
			.style("fill", "#4D4D4D")
			.attr("d", arc)
			.attr("transform", `translate(${this.svgElem.clientWidth / 2} ${this.svgElem.clientHeight / 2})`)
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

	drawTransactions(selfAccount: string, data: BananoData): void {
		const svg = d3.select(this.svgElem);
		this.resizeCanvas();
		this.clearCanvas();

		const drag = (simulation: d3.Simulation<D3Node, D3Link>) => {
			function dragstarted(event, d) {
				if (!event.active) simulation.alphaTarget(0.05).restart();
				d.fx = d.x;
				d.fy = d.y;
			}

			function dragged(event, d) {
				d.fx = event.x;
				d.fy = event.y;
			}

			function dragended(event, d) {
				if (!event.active) simulation.alphaTarget(0);
				d.fx = null;
				d.fy = null;
			}
			return d3.drag().on("start", dragstarted).on("drag", dragged).on("end", dragended);
		};
		const linkArc = d => `M${d.source.x || 0},${d.source.y || 0}A0,0 0 0,1 ${d.target.x || 0},${d.target.y || 0}`;

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

		const links = graph.links.map(d => Object.create(d));
		const nodes = graph.nodes.map(d => Object.create(d));

		const simulation = d3
			.forceSimulation(nodes)
			.force(
				"link",
				d3.forceLink(links).id((d: D3Node) => d.id)
			)
			.force("charge", d3.forceManyBody().strength(-3000))
			.force("x", d3.forceX())
			.force("y", d3.forceY());

		const link = svg
			.append("g")
			.attr("fill", "none")
			.selectAll("path")
			.data(links)
			.join("path")
			.attr("stroke-width", d => Math.log2(d.value) || 1.5);

		const node = svg
			.append("g")
			.attr("fill", "currentColor")
			.attr("stroke-linecap", "round")
			.attr("stroke-linejoin", "round")
			.selectAll("g")
			.data(nodes)
			.join("g")
			.attr("class", d => (d.id === selfAccount ? "self" : "other"))
			// @ts-ignore
			.on("dblclick", (e, n: SimulationNodeDatum) => this.hashManager.setHashParam(URLHashManager.ACCOUNT_PARAM, graph.nodes[n.index].id))
			// @ts-ignore
			.call(drag(simulation));
		node.append("circle").attr("r", 10);
		node.append("text")
			.attr("text-anchor", "middle")
			.attr("y", 25)
			.text(d => (d.id === selfAccount ? "Me" : this.abbreviateAccount(d.id)))
			.lower()
			.attr("fill", "white")
			.attr("stroke", "none");

		simulation.on("tick", () => {
			link.attr("d", d => linkArc(d));
			node.attr("transform", d => `translate(${d.x},${d.y})`);
		});
	}
}

window.addEventListener("load", () => new Visualizer());
