const proposalClassProperties = require('@babel/plugin-proposal-class-properties')
const syntaxDynamicImport = require('@babel/plugin-syntax-dynamic-import')

module.exports = function (api) {
  api.cache(true)

  const plugins = [ proposalClassProperties, syntaxDynamicImport ]

  return {
    plugins
  }
}
