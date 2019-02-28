/**
 * Set `__static` path to static files in production
 * https://simulatedgreg.gitbooks.io/electron-vue/content/en/using-static-assets.html
 */

if (process.env.NODE_ENV !== 'development') {
  global.__static = require('path').join(__dirname, '/static').replace(/\\/g, '\\\\')
}

global.MARKTEXT_DEBUG = process.env.MARKTEXT_DEBUG || process.env.NODE_ENV !== 'production'
global.MARKTEXT_SAFE_MODE = false
