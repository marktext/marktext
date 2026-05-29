/* eslint-disable @typescript-eslint/ban-ts-comment, @typescript-eslint/no-require-imports */
// @ts-nocheck
'use strict'

const path = require('path')
const thirdPartyChecker = require('./thirdPartyChecker.js')
const desktopRoot = path.resolve(__dirname, '..', 'packages/desktop')

thirdPartyChecker.validateLicenses(desktopRoot)
