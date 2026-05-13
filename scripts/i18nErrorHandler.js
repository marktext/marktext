import log from 'electron-log'
import fs from 'fs'
import path from 'path'

/**
 * i18n error handling and debugging module
 * Specifically designed for locating and debugging errors related to i18n resource files
 */

// List of supported languages
const SUPPORTED_LANGUAGES = ['en', 'zh-CN', 'zh-TW', 'es', 'fr', 'de', 'ja', 'ko', 'pt']

/**
 * Validates the format of a single translation file
 * @param {string} filePath - File path
 * @param {string} language - Language code
 * @returns {object} Validation result
 */
function validateTranslationFile(filePath, language) {
  const result = {
    language,
    filePath,
    exists: false,
    readable: false,
    validJson: false,
    parseError: null,
    content: null,
    keyCount: 0
  }

  try {
    // Check if the file exists
    result.exists = fs.existsSync(filePath)
    if (!result.exists) {
      log.warn(`[i18n] Translation file not found: ${filePath}`)
      return result
    }

    // Check if the file is readable
    try {
      fs.accessSync(filePath, fs.constants.R_OK)
      result.readable = true
    } catch (error) {
      log.error(`[i18n] Translation file not readable: ${filePath}`, error)
      return result
    }

    // Read file content
    const content = fs.readFileSync(filePath, 'utf8')

    // Attempt to parse JSON
    try {
      const parsedContent = JSON.parse(content)
      result.validJson = true
      result.content = parsedContent
      result.keyCount = Object.keys(parsedContent).length

      log.info(`[i18n] Successfully validated ${language}: ${result.keyCount} keys`)
    } catch (parseError) {
      result.parseError = {
        message: parseError.message,
        line: parseError.lineNumber || 'unknown',
        column: parseError.columnNumber || 'unknown'
      }
      log.error(`[i18n] JSON parse error in ${language}:`, parseError)
    }
  } catch (error) {
    log.error(`[i18n] Unexpected error validating ${language}:`, error)
    result.parseError = {
      message: error.message,
      type: 'unexpected'
    }
  }

  return result
}

/**
 * Gets all possible translation file paths
 * @param {string} language - Language code
 * @returns {string[]} List of possible file paths
 */
function getPossibleTranslationPaths(language) {
  return [
    // Built path (main process)
    path.join(process.cwd(), 'out', 'main', 'locales', `${language}.json`),
    // Development environment paths
    path.join(__dirname, 'locales', `${language}.json`),
    path.join(__dirname, '..', '..', 'shared', 'i18n', 'locales', `${language}.json`),
    path.join(process.cwd(), 'src', 'shared', 'i18n', 'locales', `${language}.json`)
  ]
}

/**
 * Validates all translation files
 * @returns {object} Complete validation report
 */
function validateAllTranslationFiles() {
  const report = {
    timestamp: new Date().toISOString(),
    totalLanguages: SUPPORTED_LANGUAGES.length,
    validFiles: 0,
    invalidFiles: 0,
    missingFiles: 0,
    details: {},
    summary: []
  }

  log.info('[i18n] Starting comprehensive translation file validation...')

  for (const language of SUPPORTED_LANGUAGES) {
    const possiblePaths = getPossibleTranslationPaths(language)
    let validationResult = null

    // Try each possible path
    for (const filePath of possiblePaths) {
      const result = validateTranslationFile(filePath, language)
      if (result.exists) {
        validationResult = result
        break
      }
    }

    // If no file was found
    if (!validationResult) {
      validationResult = {
        language,
        filePath: 'not found',
        exists: false,
        readable: false,
        validJson: false,
        parseError: { message: 'File not found in any expected location', type: 'missing' },
        content: null,
        keyCount: 0
      }
      report.missingFiles++
    } else if (validationResult.validJson) {
      report.validFiles++
    } else {
      report.invalidFiles++
    }

    report.details[language] = validationResult

    // Add to summary
    const status = validationResult.validJson
      ? '✅ VALID'
      : validationResult.exists ? '❌ INVALID' : '❓ MISSING'
    report.summary.push(`${language}: ${status} (${validationResult.keyCount} keys)`)
  }

  // Output detailed report
  log.info('[i18n] Translation file validation completed:')
  log.info(`[i18n] Valid files: ${report.validFiles}/${report.totalLanguages}`)
  log.info(`[i18n] Invalid files: ${report.invalidFiles}`)
  log.info(`[i18n] Missing files: ${report.missingFiles}`)

  report.summary.forEach(line => log.info(`[i18n] ${line}`))

  // If there are errors, output detailed error information
  if (report.invalidFiles > 0 || report.missingFiles > 0) {
    log.error('[i18n] Found issues with translation files:')
    Object.entries(report.details).forEach(([lang, details]) => {
      if (!details.validJson) {
        log.error(`[i18n] ${lang}: ${details.parseError?.message || 'Unknown error'}`)
        if (details.parseError?.line) {
          log.error(`[i18n] ${lang}: Error at line ${details.parseError.line}, column ${details.parseError.column}`)
        }
      }
    })
  }

  return report
}

/**
 * Tests the translation of a specific key
 * @param {string} key - Translation key
 * @param {string} language - Language code
 * @returns {object} Test result
 */
function testTranslationKey(key, language = 'en') {
  const result = {
    key,
    language,
    found: false,
    value: null,
    error: null
  }

  try {
    const possiblePaths = getPossibleTranslationPaths(language)
    let translationData = null

    for (const filePath of possiblePaths) {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8')
        translationData = JSON.parse(content)
        break
      }
    }

    if (!translationData) {
      result.error = `Translation file not found for language: ${language}`
      return result
    }

    // Supports nested keys (e.g. 'menu.file.open')
    const keys = key.split('.')
    let value = translationData

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k]
      } else {
        value = null
        break
      }
    }

    if (value !== null) {
      result.found = true
      result.value = value
    }
  } catch (error) {
    result.error = error.message
  }

  return result
}

/**
 * Set up global error listeners related to i18n
 */
function setupI18nErrorHandling() {
  log.info('[i18n] Setting up i18n error handling...')

  // Validate all translation files at application startup
  const validationReport = validateAllTranslationFiles()

  // If there are critical errors, log them; a fallback may be needed
  if (validationReport.invalidFiles > 0) {
    log.error('[i18n] Critical: Some translation files have parsing errors!')
    log.error('[i18n] This may cause application crashes when accessing translations.')
  }

  if (validationReport.missingFiles > 0) {
    log.warn('[i18n] Warning: Some translation files are missing!')
    log.warn('[i18n] Affected languages may fall back to English.')
  }

  // Listen for i18n-related errors in the process
  const originalConsoleError = console.error
  console.error = function(...args) {
    const message = args.join(' ')

    // Detect i18n-related errors
    if (message.includes('SyntaxError: 11') ||
        message.includes('parsePlural') ||
        message.includes('i18n') ||
        message.includes('translation')) {
      log.error('[i18n] Detected i18n-related error:', ...args)

      // Try to provide more debug information
      if (message.includes('SyntaxError: 11')) {
        log.error('[i18n] This appears to be a Vue i18n plural syntax error.')
        log.error('[i18n] Check for "|" characters in translation strings that may be interpreted as plural syntax.')

        // Re-validate translation files
        log.info('[i18n] Re-validating translation files due to syntax error...')
        validateAllTranslationFiles()
      }
    }

    // Call the original console.error
    originalConsoleError.apply(console, args)
  }

  log.info('[i18n] i18n error handling setup completed.')
  return validationReport
}

/**
 * Export debug utility functions
 */
export {
  setupI18nErrorHandling,
  validateAllTranslationFiles,
  validateTranslationFile,
  testTranslationKey,
  getPossibleTranslationPaths
}

/**
 * Default export: the setup function
 */
export default setupI18nErrorHandling
