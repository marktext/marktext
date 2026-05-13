/*
  Clear target locale values that are identical to EN values.
  - Preserve existing translations that differ from EN
  - Set identical string values to empty string ""
  - Does not add missing keys (use sync-locales.js --empty for that)
*/
const fs = require('fs')
const path = require('path')

const LOCALES_DIR = path.join(__dirname, '..', 'src', 'shared', 'i18n', 'locales')
const SOURCE_LOCALE = 'en.json'

const TARGETS = [
  'zh-CN.json',
  'zh-TW.json',
  'es.json',
  'fr.json',
  'de.json',
  'ja.json',
  'ko.json',
  'pt.json'
]

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function writeJson(filePath, data) {
  const content = JSON.stringify(data, null, 4) + '\n'
  fs.writeFileSync(filePath, content, 'utf8')
}

function clearSameValues(enNode, targetNode) {
  if (typeof enNode !== 'object' || enNode === null) return false
  if (typeof targetNode !== 'object' || targetNode === null) return false

  let changed = false
  for (const key of Object.keys(targetNode)) {
    const enVal = enNode[key]
    const tgVal = targetNode[key]

    // Only clear when both are strings and identical
    if (typeof enVal === 'string' && typeof tgVal === 'string') {
      if (enVal === tgVal) {
        targetNode[key] = ''
        changed = true
      }
      continue
    }

    // Recurse when both are objects
    if (typeof enVal === 'object' && enVal !== null && typeof tgVal === 'object' && tgVal !== null) {
      const subChanged = clearSameValues(enVal, tgVal)
      if (subChanged) changed = true
    }
  }
  return changed
}

function main() {
  const enPath = path.join(LOCALES_DIR, SOURCE_LOCALE)
  if (!fs.existsSync(enPath)) {
    console.error('Missing source locale:', enPath)
    process.exit(1)
  }
  const enJson = readJson(enPath)

  let changed = false
  for (const target of TARGETS) {
    const targetPath = path.join(LOCALES_DIR, target)
    if (!fs.existsSync(targetPath)) {
      // Skip non-existing targets
      continue
    }
    const localeJson = readJson(targetPath)
    const before = JSON.stringify(localeJson)
    clearSameValues(enJson, localeJson)
    const after = JSON.stringify(localeJson)
    if (before !== after) {
      writeJson(targetPath, localeJson)
      console.log('Cleared EN-identical values:', target)
      changed = true
    }
  }

  if (!changed) {
    console.log('No EN-identical values to clear. Locales are up-to-date.')
  }
}

main()
