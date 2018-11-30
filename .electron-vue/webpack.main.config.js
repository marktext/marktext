'use strict'

process.env.BABEL_ENV = 'main'

const path = require('path')
const { dependencies } = require('../package.json')
const webpack = require('webpack')
const GitRevisionPlugin = require('git-revision-webpack-plugin')
const proMode = process.env.NODE_ENV === 'production'
const isOfficialRelease = !!process.env.MARKTEXT_IS_OFFICIAL_RELEASE

const mainConfig = {
  mode: 'development',
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
            formatter: require('eslint-friendly-formatter')
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
    new webpack.NoEmitOnErrorsPlugin()
  ],
  resolve: {
    extensions: ['.js', '.json', '.node']
  },
  target: 'electron-main'
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
  mainConfig.mode = 'production'
  mainConfig.plugins.push(
    // new BabiliWebpackPlugin()
  )
}

/**
 * Add git information
 */
const gitRevisionPlugin = new GitRevisionPlugin()
mainConfig.plugins.push(
  new webpack.DefinePlugin({
    'global.MARKTEXT_GIT_INFO': JSON.stringify(gitRevisionPlugin.version()),
    'global.MARKTEXT_GIT_HASH': JSON.stringify(gitRevisionPlugin.commithash()),
    'global.MARKTEXT_IS_OFFICIAL_RELEASE': isOfficialRelease
  })
)

module.exports = mainConfig
