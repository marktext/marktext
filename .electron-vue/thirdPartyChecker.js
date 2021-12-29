'use strict'

const checker = require('license-checker')

const getLicenses = (rootDir, callback) => {
  checker.init({
    start: rootDir,
    production: true,
    development: false,
    direct: true,
    excludePackages: 'file-icons@2.1.47', // file-icons is under MIT License, but license-checker shows no license.
    json: true,
    onlyAllow: 'Unlicense;WTFPL;ISC;MIT;BSD;ISC;Apache-2.0;MIT*;Apache;Apache*;BSD*;CC0-1.0;CC-BY-4.0;CC-BY-3.0',
    customPath: {
      licenses: '',
      licenseText: 'none'
    }
  }, function (err, packages) {
    callback(err, packages, checker)
  })
}

// Check that all production dependencies are allowed.
const validateLicenses = rootDir => {
  getLicenses(rootDir, (err, packages, checker) => {
    if (err) {
      console.log(`[ERROR] ${err}`)
      process.exit(1)
    }
    console.log(checker.asSummary(packages))
  })
}

module.exports = {
  getLicenses: getLicenses,
  validateLicenses: validateLicenses
}
