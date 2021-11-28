'use strict'

const merge = require('webpack-merge')
const webpack = require('webpack')

const baseConfig = require('../../.electron-vue/webpack.renderer.config')

// Set BABEL_ENV to use proper preset config
process.env.BABEL_ENV = 'test'

let webpackConfig = merge(baseConfig, {
  devtool: '#inline-source-map',
  plugins: [
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': '"testing"'
    })
  ]
})

// don't treat dependencies as externals
delete webpackConfig.entry
delete webpackConfig.externals
delete webpackConfig.output.libraryTarget

// BUG: TypeError: Cannot read property 'loaders' of undefined
// // apply vue option to apply isparta-loader on js
// webpackConfig.module.rules
//   .find(rule => rule.use.loader === 'vue-loader').use.options.loaders.js = 'babel-loader'

module.exports = config => {
  config.set({
    browsers: ['CustomElectron'],
    customLaunchers: {
      CustomElectron: {
        base: 'Electron',
        browserWindowOptions: {
          webPreferences: {
            enableRemoteModule: true,
            contextIsolation: false,
            spellcheck: false,
            nodeIntegration: true
          }
        }
      }
    },
    mode: 'development',
    client: {
      useIframe: false
    },
    coverageReporter: {
      dir: './coverage',
      reporters: [
        { type: 'lcov', subdir: '.' },
        { type: 'text-summary' }
      ]
    },
    frameworks: ['mocha', 'chai', 'webpack'],
    files: ['./index.js'],
    preprocessors: {
      './index.js': ['webpack', 'sourcemap']
    },
    reporters: ['spec', 'coverage'],
    singleRun: true,
    webpack: webpackConfig,
    webpackMiddleware: {
      noInfo: true
    }
  })
}
