const GitRevisionPlugin = require('git-revision-webpack-plugin')
const { version } = require('../package.json')

const getEnvironmentDefinitions = function () {
  const gitRevisionPlugin = new GitRevisionPlugin()
  const isOfficialRelease = !!process.env.MARKTEXT_IS_OFFICIAL_RELEASE
  const shortHash = gitRevisionPlugin.version()
  const fullHash = gitRevisionPlugin.commithash()
  const versionSuffix = isOfficialRelease ? '' : ` (${shortHash})`
  
  return {
    'global.MARKTEXT_GIT_SHORT_HASH': JSON.stringify(shortHash),
    'global.MARKTEXT_GIT_HASH': JSON.stringify(fullHash),
  
    'global.MARKTEXT_VERSION': JSON.stringify(version),
    'global.MARKTEXT_VERSION_STRING': JSON.stringify(`v${version}${versionSuffix}`),
    'global.MARKTEXT_IS_OFFICIAL_RELEASE': JSON.stringify(isOfficialRelease)
  }
}

const getRendererEnvironmentDefinitions = function () {
  const env = getEnvironmentDefinitions()
  return {
    'process.versions.MARKTEXT_VERSION': env['global.MARKTEXT_VERSION'],
    'process.versions.MARKTEXT_VERSION_STRING': env['global.MARKTEXT_VERSION_STRING'], 
  }
}

module.exports = {
  getEnvironmentDefinitions: getEnvironmentDefinitions,
  getRendererEnvironmentDefinitions: getRendererEnvironmentDefinitions
}