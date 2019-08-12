const proposalClassProperties = require('@babel/plugin-proposal-class-properties')
const syntaxClassProperties = require('@babel/plugin-syntax-class-properties')
const transformRuntime = require('@babel/plugin-transform-runtime')
const syntaxDynamicImport = require('@babel/plugin-syntax-dynamic-import')
const functionBind = require('@babel/plugin-proposal-function-bind')
const exportDefault = require('@babel/plugin-proposal-export-default-from')
const isTanbul = require('babel-plugin-istanbul')
const presetEnv = require('@babel/preset-env')

const presetsHash = {
  test: [
    [presetEnv,
    {
      targets: { 'node': 10 }
    }]
  ],
  main: [
    [presetEnv,
    {
      targets: { 'node': 10 }
    }]
  ],
  renderer: [
    [presetEnv,
    {
      modules: false,
      useBuiltIns: false,
      targets: { electron: require('electron/package.json').version }
    }]
  ]
}

module.exports = function (api) {
  const plugins = [ proposalClassProperties, syntaxClassProperties, transformRuntime, syntaxDynamicImport, functionBind, exportDefault ]
  const env = api.env()
  const presets = presetsHash[env]

  if (env === 'test') {
    plugins.push(isTanbul)
  }

  return {
    presets,
    plugins
  }
}
