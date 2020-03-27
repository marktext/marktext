import fs from 'fs-extra'
import path from 'path'
import { SpellChecker } from '@hfelix/electron-spellchecker'
import axios from '../axios'
import { dictionaryPath } from '../spellchecker'

/**
 * Try to download the given Hunspell dictionary.
 *
 * @param {string} lang The language to download.
 */
export const downloadHunspellDictionary = async lang => {
  const url = SpellChecker.getURLForHunspellDictionary(lang)
  const response = await axios.get(url, {
    responseType: 'stream'
  })

  await fs.ensureDir(dictionaryPath)

  const dstFile = path.join(dictionaryPath, `${lang}.bdic`)
  const tmpFile = `${dstFile}.tmp`
  return new Promise((resolve, reject) => {
    const outStream = fs.createWriteStream(tmpFile)
    response.data.pipe(outStream)

    let totalLength = 0
    response.data.on('data', chunk => {
      totalLength += chunk.length
    })

    outStream.once('error', reject)
    outStream.once('finish', async () => {
      if (totalLength < 8 * 1024) {
        reject(new Error('Dictionary is most likely bogus.'))
        return
      }

      fs.move(tmpFile, dstFile, { overwrite: true })
        .then(resolve)
        .catch(reject)
    })
  })
}

/**
 * Delete the given Hunspell dictionary from disk.
 *
 * @param {string} lang The language to remove.
 */
export const deleteHunspellDictionary = async lang => {
  return await fs.remove(path.join(dictionaryPath, `${lang}.bdic`))
}
