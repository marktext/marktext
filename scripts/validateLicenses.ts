/* eslint-disable @typescript-eslint/ban-ts-comment, @typescript-eslint/no-require-imports */
// @ts-nocheck
'use strict'

const path = require('path')
const thirdPartyChecker = require('./thirdPartyChecker.js')
const rootDir = path.resolve(__dirname, '..')

thirdPartyChecker.validateLicenses(rootDir)
