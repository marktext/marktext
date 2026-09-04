import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { describe, expect, it } from 'vitest'
import { getSupportedLanguages } from 'common/i18n'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const localesDir = path.resolve(__dirname, '../../../static/locales')

describe('context menu locale coverage', () => {
  it('defines Look Up for every supported desktop locale', () => {
    for (const language of getSupportedLanguages()) {
      const localePath = path.join(localesDir, `${language}.json`)
      const locale = JSON.parse(fs.readFileSync(localePath, 'utf8')) as {
        contextMenu?: { lookUp?: unknown }
      }

      const lookUp = locale.contextMenu?.lookUp
      expect(lookUp, `${language} contextMenu.lookUp`).toEqual(expect.any(String))
      expect(lookUp).not.toBe('')
      expect(lookUp).toContain('{selection}')
    }
  })
})
