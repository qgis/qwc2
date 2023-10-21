import { BundleAnalyzerPlugin } from 'webpack-bundle-analyzer';
import { merge } from 'webpack-merge';
import common from './webpack.common.js';
import nodeExternals from 'webpack-node-externals';

// Set this to true to print the full configuration
// after merging with the common configuration.
const printWebpackConfig = false;

/**
 * Production configuration for webpack.
 */
export default (env, argv) => {
    const commonConfig = common(env, argv);
    const merged = merge(commonConfig, {
        // Available in code as process.env.NODE_ENV
        mode: 'production',

        // We have a single entry point for the library where we
        // collect all exports.
        entry: './index.js',

        plugins: [
            new BundleAnalyzerPlugin({
                analyzerMode: 'static',
                openAnalyzer: false,
                reportFilename: 'qwc2-bundle-report.html',
            })
        ],

        // A full SourceMap is emitted as a separate file. It adds a
        // reference comment to the bundle so development tools
        // know where to find it.
        devtool: 'source-map',

        output: {
            filename: 'qwc2.js',
            sourceMapFilename: 'qwc2.map',
        },

        // In order not to bundle built-in modules like path, fs, etc.
        // see https://github.com/liady/webpack-node-externals
        target: 'node', 
        externalsPresets: { node: true },

        // In order to ignore all modules in node_modules folder.
        externals: [
            nodeExternals(),
        ],
    });
    if (printWebpackConfig) {
        console.log('****************[ WEBPACK CONFIG ]********************');
        console.log(JSON.stringify(merged, null, 2));
        console.log('******************************************************');
    }
    return merged;
};
