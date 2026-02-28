const presetsEnv = require('@babel/preset-env')
const pluginProposalClassProperties = require('@babel/plugin-proposal-class-properties')
const pluginTransformRuntime = require('@babel/plugin-transform-runtime')
const pluginProposalFunctionBind = require('@babel/plugin-proposal-function-bind')
const pluginProposalExportDefaultFrom = require('@babel/plugin-proposal-export-default-from')
const pluginSyntaxDynamicImport = require('@babel/plugin-syntax-dynamic-import')
const pluginIstanbul = require('babel-plugin-istanbul')
const pluginComponent = require('babel-plugin-component')
const electronVersion = require('electron/package.json').version

module.exports = function (api) {
  api.cache(true) // Enable persistent caching

  const env = api.env()

  const presets = [
    [
      presetsEnv,
      {
        targets:
          env === 'renderer'
            ? { electron: electronVersion, node: '16' }
            : { node: '16' },
        useBuiltIns: env === 'renderer' ? false : 'usage',
        corejs: env === 'renderer' ? undefined : 3,
      },
    ],
  ]

  const plugins = [
    pluginProposalClassProperties,
    pluginTransformRuntime,
    pluginProposalFunctionBind,
    pluginProposalExportDefaultFrom,
    pluginSyntaxDynamicImport,
  ]

  if (env === 'test') {
    plugins.push(pluginIstanbul)
  } else if (env === 'renderer') {
    plugins.push([
      pluginComponent,
      {
        style: false,
        libraryName: 'element-ui',
      },
    ])
  }

  return {
    presets,
    plugins,
  }
}
