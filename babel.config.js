const proposalClassProperties = require('@babel/plugin-proposal-class-properties')
const syntaxClassProperties = require('@babel/plugin-syntax-class-properties')
const transformRuntime = require('@babel/plugin-transform-runtime')
const syntaxDynamicImport = require('@babel/plugin-syntax-dynamic-import')
const functionBind = require('@babel/plugin-proposal-function-bind')
const exportDefault = require('@babel/plugin-proposal-export-default-from')
const isTanbul = require('babel-plugin-istanbul')
const component = require('babel-plugin-component')
const presetEnv = require('@babel/preset-env')

const presetsHash = {
  test: [
    [presetEnv,
    {
      targets: { 'node': 16 }
    }]
  ],
  main: [
    [presetEnv,
    {
      targets: { 'node': 16 }
    }]
  ],
  renderer: [
    [presetEnv,
    {
      useBuiltIns: false,
      targets: {
        electron: require('electron/package.json').version,
        node: 16
      }
    }]
  ]
}

module.exports = function (api) {
  const plugins = [ proposalClassProperties, syntaxClassProperties, transformRuntime, syntaxDynamicImport, functionBind, exportDefault ]
  const env = api.env()
  const presets = presetsHash[env]

  if (env === 'test') {
    plugins.push(isTanbul)
  } else if (env === 'renderer') {
    plugins.push(
      [component, {
        style: false,
        libraryName: 'element-ui'
      }
    ])
  }

  return {
    presets,
    plugins
  }
}
