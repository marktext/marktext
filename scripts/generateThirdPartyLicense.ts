/* eslint-disable @typescript-eslint/ban-ts-comment, @typescript-eslint/no-require-imports */
// @ts-nocheck
'use strict'

const path = require('path')
const fs = require('fs')
const thirdPartyChecker = require('./thirdPartyChecker.js')
const rootDir = path.resolve(__dirname, '..')

thirdPartyChecker.getLicenses(rootDir, (err, packages) => {
  if (err) {
    console.log(`[ERROR] ${err}`)
    return
  }

  let summary = ''
  let licenseList = ''
  let index = 1
  const addedKeys = {}

  Object.keys(packages).forEach((key) => {
    let packageName = key
    const nameRegex = /(^.+)(?:@)/.exec(key)
    if (nameRegex && nameRegex[1]) {
      packageName = nameRegex[1]
    }

    if (Object.hasOwn(addedKeys, packageName)) {
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

  fs.writeFileSync(path.resolve(rootDir, 'build', 'THIRD-PARTY-LICENSES.txt'), output)
  console.log('THIRD-PARTY-LICENSES.txt generated successfully.')
})
