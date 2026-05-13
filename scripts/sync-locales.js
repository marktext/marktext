/*
  Sync missing keys from en.json into all target locale files.
  - Preserve existing translations
  - Fill missing keys with English text
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

function mergeMissingKeys(src, dst, fillEmpty) {
  if (typeof src !== 'object' || src === null) return dst
  if (typeof dst !== 'object' || dst === null) dst = Array.isArray(src) ? [] : {}

  for (const key of Object.keys(src)) {
    if (typeof src[key] === 'object' && src[key] !== null) {
      dst[key] = mergeMissingKeys(src[key], dst[key], fillEmpty)
    } else if (!(key in dst)) {
      dst[key] = fillEmpty ? '' : src[key]
    }
  }
  return dst
}

function main() {
  const fillEmpty = process.argv.includes('--empty') || process.env.FILL_EMPTY === '1'
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
      // If target file missing, create from en.json
      writeJson(targetPath, enJson)
      console.log('Created locale from EN:', target)
      changed = true
      continue
    }

    const localeJson = readJson(targetPath)
    const before = JSON.stringify(localeJson)
    const merged = mergeMissingKeys(enJson, localeJson, fillEmpty)
    const after = JSON.stringify(merged)
    if (before !== after) {
      writeJson(targetPath, merged)
      console.log('Filled missing keys:', target)
      changed = true
    }
  }

  if (!changed) {
    console.log('No missing keys. Locales are up-to-date.')
  }
}

main()
