'use strict'

const path = require('path')
const thirdPartyChecker = require('./thirdPartyChecker.js')
const rootDir = path.resolve(__dirname, '..')

thirdPartyChecker.validateLicenses(rootDir)
