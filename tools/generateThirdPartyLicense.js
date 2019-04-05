'use strict'

const path = require('path')
const fs = require('fs')
const thirdPartyChecker = require('../.electron-vue/thirdPartyChecker.js')
const rootDir = path.resolve(__dirname, '..')

thirdPartyChecker.getLicenses(rootDir, (err, packages, checker) => {
  if (err) {
    console.log(`[ERROR] ${err}`)
    return
  }

  let summary = ''
  let licenseList = ''
  let index = 1
  Object.keys(packages).forEach(key => {
    if (/^babel-helper-vue-jsx-merge-props/.test(key) ||
      /^marktext/.test(key)) {
      // babel-helper-vue-jsx-merge-props: MIT licensed used by element-ui
      return
    }

    const { licenses, licenseText } = packages[key]
    summary += `${index++}. ${key} (${licenses})\n`
    licenseList += `# ${key} (${licenses})
-------------------------------------------------\

${licenseText}
\n\n
`
  })


  const output = `# Third Party Notices
-------------------------------------------------

This file contains all third-party packages which are bundled and shipped with Mark Text.

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
