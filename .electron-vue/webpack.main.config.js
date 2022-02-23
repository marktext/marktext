'use strict'

process.env.BABEL_ENV = 'main'

const path = require('path')
const webpack = require('webpack')
const ESLintPlugin = require('eslint-webpack-plugin')

const { getEnvironmentDefinitions } = require('./marktextEnvironment')
const { dependencies } = require('../package.json')

const isProduction = process.env.NODE_ENV === 'production'

/** @type {import('webpack').Configuration} */
const mainConfig = {
  mode: 'development',
  devtool: 'eval-cheap-module-source-map',
  optimization: {
    emitOnErrors: false
  },
  entry: {
    main: path.join(__dirname, '../src/main/index.js')
  },
  externals: [
    ...Object.keys(dependencies || {})
  ],
  module: {
    rules: [
      {
        test: /\.js$/,
        use: 'babel-loader',
        exclude: /node_modules/
      },
      {
        test: /\.node$/,
        loader: 'node-loader',
        options: {
          name: '[name].[ext]'
        }
      }
    ]
  },
  node: {
    __dirname: !isProduction,
    __filename: !isProduction
  },
  cache: false,
  output: {
    filename: '[name].js',
    libraryTarget: 'commonjs2',
    path: path.join(__dirname, '../dist/electron')
  },
  plugins: [
    new ESLintPlugin({
      extensions: ['js'],
      files: [
        'src',
        'test'
      ],
      exclude: [
        'node_modules'
      ],
      emitError: true,
      failOnError: true,
      // NB: Threads must be disabled, otherwise no errors are emitted.
      threads: false,
      formatter: require('eslint-friendly-formatter'),
      context: path.resolve(__dirname, '../'),
      overrideConfigFile: '.eslintrc.js'
    }),
    // Add global environment definitions.
    new webpack.DefinePlugin(getEnvironmentDefinitions())
  ],
  resolve: {
    alias: {
      'common': path.join(__dirname, '../src/common')
    },
    extensions: ['.js', '.json', '.node']
  },
  target: 'electron-main'
}

// Fix debugger breakpoints
if (!isProduction && process.env.MARKTEXT_BUILD_VSCODE_DEBUG) {
  mainConfig.devtool = 'inline-source-map'
}

/**
 * Adjust mainConfig for development settings
 */
if (!isProduction) {
  mainConfig.cache = {
    name: 'main-dev',
    type: 'filesystem'
  }
  mainConfig.plugins.push(
    new webpack.DefinePlugin({
      '__static': `"${path.join(__dirname, '../static').replace(/\\/g, '\\\\')}"`
    })
  )
}

/**
 * Adjust mainConfig for production settings
 */
if (isProduction) {
  mainConfig.devtool = 'nosources-source-map'
  mainConfig.mode = 'production'
  mainConfig.optimization.minimize = true
}

module.exports = mainConfig
