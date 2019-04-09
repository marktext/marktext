'use strict'

process.env.BABEL_ENV = 'main'

const path = require('path')
const { getEnvironmentDefinitions } = require('./marktextEnvironment')
const { dependencies } = require('../package.json')
const webpack = require('webpack')
const proMode = process.env.NODE_ENV === 'production'

const mainConfig = {
  mode: 'development',
  devtool: '#cheap-module-eval-source-map',
  entry: {
    main: path.join(__dirname, '../src/main/index.js')
  },
  externals: [
    ...Object.keys(dependencies || {})
  ],
  module: {
    rules: [
      {
        test: /\.(js)$/,
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
        test: /\.js$/,
        use: 'babel-loader',
        exclude: /node_modules/
      },
      {
        test: /\.node$/,
        use: 'node-loader'
      }
    ]
  },
  node: {
    __dirname: !proMode,
    __filename: !proMode
  },
  output: {
    filename: '[name].js',
    libraryTarget: 'commonjs2',
    path: path.join(__dirname, '../dist/electron')
  },
  plugins: [
    new webpack.NoEmitOnErrorsPlugin(),
    // Add global environment definitions.
    new webpack.DefinePlugin(getEnvironmentDefinitions())
  ],
  resolve: {
    extensions: ['.js', '.json', '.node']
  },
  target: 'electron-main'
}

// Fix debugger breakpoints
if (!proMode && process.env.MARKTEXT_BUILD_VSCODE_DEBUG) {
  mainConfig.devtool = '#inline-source-map'
}

/**
 * Adjust mainConfig for development settings
 */
if (!proMode) {
  mainConfig.plugins.push(
    new webpack.DefinePlugin({
      '__static': `"${path.join(__dirname, '../static').replace(/\\/g, '\\\\')}"`
    })
  )
}

/**
 * Adjust mainConfig for production settings
 */
if (proMode) {
  mainConfig.devtool = '#nosources-source-map'
  mainConfig.mode = 'production'
}

module.exports = mainConfig
