'use strict'

const path = require('path')
const fs = require('fs')
const thirdPartyChecker = require('../.electron-vue/thirdPartyChecker.js')
const rootDir = path.resolve(__dirname, '..')

const additionalPackages = {
  hunspell: {
    packageName: 'Hunspell',
    licenses: 'LGPL 2.1',
    licenseText: fs.readFileSync(path.join(rootDir, 'resources/hunspell_dictionaries/LICENSE-hunspell.txt'))
  }
}

thirdPartyChecker.getLicenses(rootDir, (err, packages, checker) => {
  if (err) {
    console.log(`[ERROR] ${err}`)
    return
  }

  Object.assign(packages, additionalPackages)

  let summary = ''
  let licenseList = ''
  let index = 1
  const addedKeys = {}
  Object.keys(packages).forEach(key => {
    if (/^babel-helper-vue-jsx-merge-props/.test(key) ||
      /^marktext/.test(key)) {
      // babel-helper-vue-jsx-merge-props: MIT licensed used by element-ui
      return
    }

    let packageName = key
    const nameRegex = /(^.+)(?:@)/.exec(key)
    if (nameRegex && nameRegex[1]) {
      packageName = nameRegex[1]
    }

    // Check if we already added this package
    if (addedKeys.hasOwnProperty(packageName)) {
      return
    }
    addedKeys[packageName] = 1

    const { licenses, licenseText } = packages[key]
    summary += `${index++}. ${packageName} (${licenses})\n`
    licenseList += `# ${packageName} (${licenses})
-------------------------------------------------\

${licenseText}
\n\n
`
  })


  const output = `# Third Party Notices
-------------------------------------------------

This file contains all third-party packages that are bundled and shipped with MarkText.

-------------------------------------------------
# Summary
-------------------------------------------------

${summary}

-------------------------------------------------
# Licenses
-------------------------------------------------

${licenseList}
`
  fs.writeFileSync(path.resolve(rootDir, 'resources', 'THIRD-PARTY-LICENSES.txt'), output)
})
