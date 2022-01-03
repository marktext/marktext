/**
 * This file is used specifically and only for development. It installs
 * `vue-devtools`. There shouldn't be any need to modify this file,
 * but it can be used to extend your development environment.
 */

/* eslint-disable */
require('dotenv').config()

// Install `vue-devtools`
require('electron').app.on('ready', () => {
  const { default: installExtension, VUEJS_DEVTOOLS } = require('electron-devtools-installer')
  installExtension(VUEJS_DEVTOOLS)
    .then(() => {})
    .catch(err => {
      console.log('Unable to install `vue-devtools`: \n', err)
    })
})

/* eslint-enable */

// Require `main` process to boot app
require('./index')
