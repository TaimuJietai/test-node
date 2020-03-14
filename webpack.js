const path = require('path');
const TerserPlugin = require('terser-webpack-plugin');
const webpack = require('webpack');
const config = {
	mode: 'production',
	entry: path.join(__dirname, './webpack/test.js'),
	output: {
		path: path.join(__dirname, './webpack'),
		filename: 'test-min.js'
	},
	plugins: [],
	optimization: {
		minimize: true,
		minimizer: [new TerserPlugin({
			test: /\.js(\?.*)?$/i,
			parallel: true,
			sourceMap: true
		})]
	}
};
if (process.argv.indexOf('npm_config_report=true') !== -1) {
	const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;
	config.plugins.push(new BundleAnalyzerPlugin())
}

module.exports = () => new Promise(resolve => {
  webpack(config, (err, stats) => {
    if (err) throw err;
    process.stdout.write(stats.toString({
      colors: true,
      modules: false,
      children: false,
      chunks: false,
      chunkModules: true
    }) + '\n');
    console.log('\nbuilding for production... \n');
    resolve('success');
  });
});