'use strict'

const path = require('path')
const thirdPartyChecker = require('../.electron-vue/thirdPartyChecker.js')
const rootDir = path.resolve(__dirname, '..')

thirdPartyChecker.validateLicenses(rootDir)
