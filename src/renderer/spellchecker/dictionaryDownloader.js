import fs from 'fs-extra'
import path from 'path'
import axios from 'axios'
import { SpellChecker } from 'electron-spellchecker'
import { dictionaryPath } from '../spellchecker'

/**
 * Try to download the given Hunspell dictionary.
 *
 * @param {string} lang The language to download.
 */
export const downloadHunspellDictionary = async lang => {
  const url = SpellChecker.getURLForHunspellDictionary(lang)
  const response = await axios({
    method: 'get',
    url,
    responseType: 'stream'
  })
  response.data.pipe(fs.createWriteStream(path.join(dictionaryPath, `${lang}.bdic`)))
  return true
}

/**
 * Delete the given Hunspell dictionary from disk.
 *
 * @param {string} lang The language to remove.
 */
export const deleteHunspellDictionary = async lang => {
  return await fs.remove(path.join(dictionaryPath, `${lang}.bdic`))
}
