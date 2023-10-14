import { merge } from 'webpack-merge';
import { resolve } from 'path';

import common, { lib_root_dir } from './webpack.common.js';

// Set this to true to print the full configuration
// after merging with the common configuration.
const printWebpackConfig = false;

// Notes on plugins used in demo app:
// - DefinePlugin: 
//   - process.env.NODE_ENV is set by webpack
//     https://webpack.js.org/configuration/mode/#root
//   - __DEVTOOLS__ is not set in production, it is only needed if
//     one needs to disable Redux Devtools in development
//     https://github.com/erikras/react-redux-universal-hot-example/blob/master/README.md
// - NamedModulesPlugin: not needed in webpack5
//   https://github.com/webpack/webpack/issues/11637#issuecomment-706718119
// - NoEmitOnErrorsPlugin: no longer needed
//   https://stackoverflow.com/questions/40080501/webpack-when-to-use-noerrorsplugin
// - LoaderOptionsPlugin is for ancient loaders, page no longer
//   present in webpack 5 docs
//   https://v4.webpack.js.org/plugins/loader-options-plugin/
// - HotModuleReplacementPlugin: enabled via devServer.hot

/**
 * Development configuration for webpack.
 */
export default (env, argv) => {
    const merged = merge(common(env, argv), {
        // Available in code as process.env.NODE_ENV
        mode: 'development',
        entry: [
            'react-hot-loader/patch',
            './index.js'
        ],

        // Each module is executed with eval() and a SourceMap
        // is added as a DataUrl, Source Maps from Loaders are
        // processed for better results.  Line numbers are correctly
        // mapped since it gets mapped to the original code
        devtool: 'eval-cheap-module-source-map',

        output: {
            // Generated files are placed in a distinct directory
            // so that `clean` from production does not vipe
            // out development output and vice-versa.
            path: resolve(lib_root_dir, 'dist-dev'),
            // under a distinct name.
            filename: 'qwc2-dev.js',
        },
        devServer: {
            'static': {
                directory: './dist-dev'
            },
            port: 7771,
            hot: true,
        },
    });
    if (printWebpackConfig) {
        console.log('****************[ WEBPACK CONFIG ]********************');
        console.log(JSON.stringify(merged, null, 2));
        console.log('******************************************************');
    }
    return merged;
};
