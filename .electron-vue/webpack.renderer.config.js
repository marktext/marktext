'use strict'

process.env.BABEL_ENV = 'renderer'

const path = require('path')
const webpack = require('webpack')
const CopyWebpackPlugin = require('copy-webpack-plugin')
const MiniCssExtractPlugin = require("mini-css-extract-plugin")
const HtmlWebpackPlugin = require('html-webpack-plugin')
const VueLoaderPlugin = require('vue-loader/lib/plugin')
const SpritePlugin = require('svg-sprite-loader/plugin')
const postcssPresetEnv = require('postcss-preset-env')
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer')

const { getRendererEnvironmentDefinitions } = require('./marktextEnvironment')
const { dependencies } = require('../package.json')
const proMode = process.env.NODE_ENV === 'production'
/**
 * List of node_modules to include in webpack bundle
 * Required for specific packages like Vue UI libraries
 * that provide pure *.vue files that need compiling
 * https://simulatedgreg.gitbooks.io/electron-vue/content/en/webpack-configurations.html#white-listing-externals
 */
const whiteListedModules = ['vue']

const rendererConfig = {
  mode: 'development',
  devtool: '#cheap-module-eval-source-map',
  entry: {
    renderer: path.join(__dirname, '../src/renderer/main.js')
  },
  externals: [
    ...Object.keys(dependencies || {}).filter(d => !whiteListedModules.includes(d))
  ],
  module: {
    rules: [
      {
        test: /\.(js|vue)$/,
        enforce: 'pre',
        exclude: /node_modules/,
        use: {
          loader: 'eslint-loader',
          options: {
            formatter: require('eslint-friendly-formatter'),
            failOnError: true
          }
        }
      },
      {
        test: /(katex|github\-markdown|prism[\-a-z]*|\.theme)\.css$/,
        use: [
          'to-string-loader',
          'css-loader'
        ]
      },
      {
        test: /\.css$/,
        exclude: /(katex|github\-markdown|prism[\-a-z]*|\.theme)\.css$/,
        use: [
          proMode ? MiniCssExtractPlugin.loader : 'style-loader',
          { loader: 'css-loader', options: { importLoaders: 1 } },
          { loader: 'postcss-loader', options: {
            ident: 'postcss',
            plugins: () => [
              postcssPresetEnv({
                stage: 0
              })
            ]
          } }
        ]
      },
      {
        test: /\.html$/,
        use: 'vue-html-loader'
      },
      {
        test: /\.js$/,
        use: 'babel-loader',
        exclude: /node_modules/
      },
      {
        test: /\.node$/,
        use: 'node-loader'
      },
      {
        test: /\.vue$/,
        use: {
          loader: 'vue-loader',
          options: {
            sourceMap: true
          }
        }
      },
      {
        test: /\.svg$/,
        use: [
          {
            loader: 'svg-sprite-loader',
            options: {
              extract: true,
              publicPath: './static/'
            }
          },
          'svgo-loader'
        ]
      },
      {
        test: /\.(png|jpe?g|gif)(\?.*)?$/,
        use: {
          loader: 'url-loader',
          query: {
            limit: 10000,
            name: 'imgs/[name]--[folder].[ext]'
          }
        }
      },
      {
        test: /\.(mp4|webm|ogg|mp3|wav|flac|aac)(\?.*)?$/,
        loader: 'url-loader',
        options: {
          limit: 10000,
          name: 'media/[name]--[folder].[ext]'
        }
      },
      {
        test: /\.(woff2?|eot|ttf|otf)(\?.*)?$/,
        use: {
          loader: 'url-loader',
          query: {
            limit: 100000,
            name: 'fonts/[name]--[folder].[ext]'
          }
        }
      }
    ]
  },
  node: {
    __dirname: !proMode,
    __filename: !proMode
  },
  plugins: [
    new SpritePlugin(),
    new HtmlWebpackPlugin({
      filename: 'index.html',
      template: path.resolve(__dirname, '../src/index.ejs'),
      minify: {
        collapseWhitespace: true,
        removeAttributeQuotes: true,
        removeComments: true
      },
      nodeModules: process.env.NODE_ENV !== 'production'
        ? path.resolve(__dirname, '../node_modules')
        : false
    }),
    new webpack.NoEmitOnErrorsPlugin(),
    new webpack.DefinePlugin(getRendererEnvironmentDefinitions()),
    new VueLoaderPlugin()
  ],
  output: {
    filename: '[name].js',
    libraryTarget: 'commonjs2',
    path: path.join(__dirname, '../dist/electron')
  },
  resolve: {
    alias: {
      '@': path.join(__dirname, '../src/renderer'),
      'muya': path.join(__dirname, '../src/muya'),
      'vue$': 'vue/dist/vue.esm.js'
    },
    extensions: ['.js', '.vue', '.json', '.css', '.node']
  },
  target: 'electron-renderer'
}

/**
 * Adjust rendererConfig for development settings
 */
if (!proMode) {
  rendererConfig.plugins.push(
    new webpack.DefinePlugin({
      '__static': `"${path.join(__dirname, '../static').replace(/\\/g, '\\\\')}"`
    }),
    new webpack.HotModuleReplacementPlugin()
  )
}

if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test' &&
  !process.env.MARKTEXT_DEV_HIDE_BROWSER_ANALYZER) {
  rendererConfig.plugins.push(
    new BundleAnalyzerPlugin()
  )
}

// Fix debugger breakpoints
if (!proMode && process.env.MARKTEXT_BUILD_VSCODE_DEBUG) {
  rendererConfig.devtool = '#inline-source-map'
}

/**
 * Adjust rendererConfig for production settings
 */
if (proMode) {
  rendererConfig.devtool = '#nosources-source-map'
  rendererConfig.mode = 'production'
  rendererConfig.plugins.push(
    new MiniCssExtractPlugin({
      // Options similar to the same options in webpackOptions.output
      // both options are optional
      filename: '[name].[hash].css',
      chunkFilename: '[id].[hash].css'
    }),
    new CopyWebpackPlugin([
      {
        from: path.join(__dirname, '../static'),
        to: path.join(__dirname, '../dist/electron/static'),
        ignore: ['.*']
      },
      {
        from: path.resolve(__dirname, '../node_modules/codemirror/mode/*/*'),
        to: path.join(__dirname, '../dist/electron/codemirror/mode/[name]/[name].js')
      }
    ]),
    new webpack.LoaderOptionsPlugin({
      minimize: true
    })
  )
}

module.exports = rendererConfig
