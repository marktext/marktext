// Set `__static` path to static files in production
if (process.env.NODE_ENV !== 'development') {
  global.__static = require('path').join(__dirname, '/static').replace(/\\/g, '\\\\')
}

global.MARKTEXT_DEBUG = process.env.MARKTEXT_DEBUG || process.env.NODE_ENV !== 'production'
global.MARKTEXT_DEBUG_VERBOSE = global.MARKTEXT_DEBUG && process.env.MARKTEXT_DEBUG_VERBOSE
global.MARKTEXT_SAFE_MODE = false
