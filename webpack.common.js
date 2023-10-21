
import HtmlWebpackPlugin from 'html-webpack-plugin';
import webpack from 'webpack';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);

// Absolute path to the root directory of this library.
export const lib_root_dir = dirname(__filename);

/**
 * Common configuration for webpack in all environments.
 */
export default (env, argv) => {
    return {
        plugins: [
            // This plugin generates an HTML file with <script> injected.
            // The generated file is automatically added to the build folder.
            new HtmlWebpackPlugin({
                title: 'QWC2 [' + argv.mode + ']',
                templateContent: ({ htmlWebpackPlugin }) =>
                    '<!DOCTYPE html>' +
                    '<html>' +
                    '<head>' +
                    '<meta charset=\"utf-8\">' +
                    '<title>' + htmlWebpackPlugin.options.title + '</title>' +
                    '</head>' +
                    '<body>' +
                    '<div id=\"app\"></div>' +
                    '</body>' +
                    '</html>',
                filename: argv.mode === 'production'
                    ? 'index.html'
                    : 'index-dev.html',
            }),

            // Customized openlayers implementation. 
            new webpack.NormalModuleReplacementPlugin(
                /openlayers$/,
                join(lib_root_dir, "libs", "openlayers")
            ),
        ],
        output: {
            // Clean up the dist folder before each build.
            clean: true,

            // We exposed the entry point as qwc2 so users can use
            // it through script tag:
            //   <script src="qwc2.js"></script>
            //   <script>window.qwc2.doSomething('nice');</script>
            // 'umd' means the library can be used as:
            //   - AMD module
            //   - CommonJS module
            //   - Global variable
            // https://webpack.js.org/guides/author-libraries/
            library: {
                name: 'qwc2',
                type: 'umd'
            },

            // Indicates what global object will be used to mount the library.
            // To make UMD build available on both browsers and Node.js
            // we need to set the globalObject option to this.
            globalObject: 'this',
        },
        resolve: {
            extensions: [".mjs", ".js", ".jsx", '.ts', '.tsx'],
            symlinks: false,
            mainFiles: ['index'],
        },

        module: {
            rules: [
                { 
                    test: /\.tsx?$/, 
                    loader: 'ts-loader',
                    exclude: /node_modules/,
                },
                {
                    test: /\.(js|jsx)$/,
                    use: 'babel-loader',
                    exclude: /node_modules/,
                    resolve: {
                        fullySpecified: false,
                    }
                },
                {
                    test: /\.css$/,
                    use: [
                        'style-loader',
                        'css-loader'
                    ]
                },
                {
                    test: /\.svg$/,
                    use: 'file-loader'
                },
                {
                    test: /\.png$/,
                    use: [
                        {
                            loader: 'url-loader',
                            options: {
                                mimetype: 'image/png'
                            }
                        }
                    ]
                }
            ]
        },
    };
}
