'use strict'

process.env.BABEL_ENV = 'renderer'

const path = require('path')
const MiniCssExtractPlugin = require('mini-css-extract-plugin')
const postcssPresetEnv = require('postcss-preset-env')

/** @type {import('webpack').Configuration} */
module.exports = {
  mode: 'production',
  devtool: 'hidden-nosources-source-map',
  optimization: {
    emitOnErrors: false,
    minimize: true
  },
  entry: {
    renderer: path.join(__dirname, './lib/index.js')
  },
  module: {
    rules: [
      {
        test: require.resolve(path.join(__dirname, './lib/assets/libs/snap.svg-min.js')),
        use: 'imports-loader?this=>window,fix=>module.exports=0'
      },
      {
        test: /(theme\-chalk(?:\/|\\)index|exportStyle|katex|github\-markdown|prism[\-a-z]*|\.theme|headerFooterStyle)\.css$/,
        use: [
          'to-string-loader',
          'css-loader'
        ]
      },
      {
        test: /\.css$/,
        use: [
          MiniCssExtractPlugin.loader,
          {
            loader: 'css-loader',
            options: { importLoaders: 1 }
          },
          {
            loader: 'postcss-loader',
            options: {
              postcssOptions: {
                plugins: [
                  postcssPresetEnv({ stage: 0 })
                ]
              }
            }
          }
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
        test: /\.(png|jpe?g|gif|svg)(\?.*)?$/,
        type: 'asset',
        generator: {
          filename: 'images/[name].[contenthash:8][ext]'
        }
      },
      {
        test: /\.(mp4|webm|ogg|mp3|wav|flac|aac)(\?.*)?$/,
        type: 'asset/resource',
        generator: {
          filename: 'media/[name].[contenthash:8][ext]'
        }
      },
      {
        test: /\.(woff2?|eot|ttf|otf)(\?.*)?$/,
        type: 'asset/resource',
        generator: {
          filename: 'fonts/[name].[contenthash:8][ext]'
        }
      }
    ]
  },
  plugins: [
    new MiniCssExtractPlugin({
      // Options similar to the same options in webpackOptions.output
      // both options are optional
      filename: 'index.min.css'
    })
  ],
  output: {
    filename: 'index.min.js',
    libraryTarget: 'umd',
    library: 'Muya',
    path: path.join(__dirname, './dist')
  },
  resolve: {
    alias: {
      snapsvg: path.join(__dirname, './lib/assets/libs/snap.svg-min.js')
    },
    extensions: ['.js', '.vue', '.json', '.css', '.node'],
    fallback: {
      fs: false,
      path: require.resolve('path-browserify')
    }
  }
}
