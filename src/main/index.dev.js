/**
 * This file is used specifically and only for development. It installs
 * `vue-devtools`. There shouldn't be any need to modify this file,
 * but it can be used to extend your development environment.
 */

/* eslint-disable */
require('dotenv').config()

// Install `vue-devtools`
require('electron').app.on('ready', () => {
  let installExtension = require('electron-devtools-installer')
  // WORKAROUND: Electron: 2.0.0 does not match required range
  // https://github.com/MarshallOfSound/electron-devtools-installer/issues/73
  installExtension.default(installExtension.VUEJS_DEVTOOLS.id)
    .then(() => {})
    .catch(err => {
      console.log('Unable to install `vue-devtools`: \n', err)
    })
})

/* eslint-enable */

// Require `main` process to boot app
require('./index')
