/* eslint-disable @typescript-eslint/ban-ts-comment */
import * as d3 from "d3";
import { SimulationLinkDatum, SimulationNodeDatum } from "d3";
import _ from "lodash";
import "../style/force.less";
import { AUTHOR_WALLET, BANOSHI } from "./constants";
import { APIResponse, LoaderConfig } from "./types";
import { URLHashManager } from "./URLHashManager";
import { abbreviateAccount, fetchAccountHistory, setClipboard } from "./utils";

export interface D3Node extends SimulationNodeDatum {
	id: string;
}

export interface D3Link extends SimulationLinkDatum<D3Node> {
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

		addEventListener(URLHashManager.ACCOUNT_CHANGE_EVENT, (e: CustomEvent<string>) => this.selectAccount(e.detail));

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
			-this.svgElem.clientWidth / 2,
			-this.svgElem.clientHeight / 2,
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
			const data: APIResponse = await fetchAccountHistory(account);
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

	getNodes(data: APIResponse): D3Node[] {
		const history = _(data.history)
			.map("account")
			.uniq()
			.map(id => ({ id }))
			.value();

		return [{ id: data.account }, ...history];
	}

	getLinks(data: APIResponse): D3Link[] {
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
			.attr("stroke-linecap", "round")
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

	drawTransactions(selfAccount: string, data: APIResponse): void {
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

		const link = svg.append("g").attr("fill", "none").selectAll("path").data(links).join("path").attr("stroke-width", 1.5);

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
		node.append("circle").attr("r", (d: D3Node) => {
			if (graph.nodes[d.index].id === selfAccount) {
				return 15;
			}
			return (
				Math.log2(
					_(graph.links)
						.filter(l => l.value > 0)
						.filter(l => l.target === graph.nodes[d.index].id)
						.first()?.value || 10
				) || 10
			);
		});
		node.append("text")
			.attr("text-anchor", "middle")
			.attr("y", (d: D3Node) => {
				if (graph.nodes[d.index].id === selfAccount) {
					return 15 + 15;
				}
				return (
					15 +
					(Math.log2(
						_(graph.links)
							.filter(l => l.value > 0)
							.filter(l => l.target === graph.nodes[d.index].id)
							.first()?.value || 10
					) || 10)
				);
			})
			.text(d => (d.id === selfAccount ? "Me" : abbreviateAccount(d.id)))
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
