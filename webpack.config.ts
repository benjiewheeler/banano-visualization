import HtmlWebPackPlugin from "html-webpack-plugin";
import path from "path";
import webpack from "webpack";

const config: webpack.Configuration = {
	entry: "./src/index.ts",
	output: {
		path: path.resolve(__dirname, "./dist"),
	},
	module: {
		rules: [
			{ test: /\.ts$/, use: ["ts-loader"] },
			{ test: /\.less$/i, use: ["style-loader", "css-loader", "less-loader"] },
			{ test: /\.(png|ico)$/, use: ["file-loader"] },
			{ test: /\.js$/, enforce: "pre", use: ["source-map-loader"] },
		],
	},
	resolve: {
		extensions: [".html", ".css", ".js", ".ts"],
	},
	plugins: [
		new HtmlWebPackPlugin({
			inject: "head",
			cache: true,
			favicon: "./src/graph.png",
			minify: false,
			template: "./src/index.html",
			filename: "./index.html",
		}),
	],
	watchOptions: {
		ignored: ["./dist/**/*", "./node_modules/**"],
		aggregateTimeout: 3000,
	},
};

export default config;
