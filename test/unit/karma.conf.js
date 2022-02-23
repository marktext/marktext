'use strict'

const fs = require('fs')
const path = require('path')
const { merge } = require('webpack-merge')
const webpack = require('webpack')

const baseConfig = require('../../.electron-vue/webpack.renderer.config')

// Set BABEL_ENV to use proper preset config
process.env.BABEL_ENV = 'test'

// We need to create the build directory before launching Karma.
try {
  fs.mkdirSync(path.join('dist', 'electron'), { recursive: true })
} catch(e) {
  if (e.code !== 'EEXIST') {
    throw e
  }
}

let webpackConfig = merge(baseConfig, {
  devtool: 'inline-source-map',
  cache: false,
  output: {
    publicPath: '/'
  },
  plugins: [
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': '"development"'
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
    browserNoActivityTimeout: 120000,
    browserDisconnectTimeout: 60000,
    browsers: ['CustomElectron'],
    customLaunchers: {
      CustomElectron: {
        base: 'Electron',
        browserWindowOptions: {
          webPreferences: {
            contextIsolation: false,
            spellcheck: false,
            nodeIntegration: true,
            webSecurity: false,
            sandbox: false
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
