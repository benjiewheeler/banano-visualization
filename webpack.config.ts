import HtmlWebPackPlugin from "html-webpack-plugin";
import path from "path";
import webpack from "webpack";

const config: webpack.Configuration = {
	entry: {
		index: "./src/scripts/index.ts",
		force: "./src/scripts/force.ts",
		sankey: "./src/scripts/sankey.ts",
	},
	output: {
		path: path.resolve(__dirname, "./dist"),
	},
	module: {
		rules: [
			{ test: /\.ts$/, loader: "ts-loader", options: { configFile: "./tsconfig.frontend.json" } },
			{ test: /\.less$/i, use: ["style-loader", "css-loader", "less-loader"] },
			{ test: /\.html$/i, use: ["html-loader"] },
			{ test: /\.js$/, enforce: "pre", use: ["source-map-loader"] },
		],
	},
	resolve: {
		extensions: [".html", ".css", ".js", ".ts", ".png"],
	},
	plugins: [
		new HtmlWebPackPlugin({
			cache: true,
			chunks: ["index"],
			favicon: "./src/images/favicon.png",
			filename: "./index.html",
			inject: "head",
			minify: false,
			scriptLoading: "blocking",
			template: "./src/html/index.html",
		}),
		new HtmlWebPackPlugin({
			cache: true,
			chunks: ["sankey"],
			favicon: "./src/images/favicon.png",
			filename: "./sankey.html",
			inject: "head",
			minify: false,
			scriptLoading: "blocking",
			template: "./src/html/sankey.html",
		}),
		new HtmlWebPackPlugin({
			cache: true,
			chunks: ["force"],
			favicon: "./src/images/favicon.png",
			filename: "./force.html",
			inject: "head",
			minify: false,
			scriptLoading: "blocking",
			template: "./src/html/force.html",
		}),
	],
	watchOptions: {
		ignored: ["./dist/**/*", "./node_modules/**"],
		aggregateTimeout: 3000,
	},
};

export default config;
