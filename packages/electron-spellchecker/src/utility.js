const { parse } = require('bcp47');

/**
 * Normalizes language codes by case and separator. Unfortunately, different
 * platforms have slightly different standards for language codes (i.e. 'en_US' vs
 * 'en-us'). This method flattens them all to the way that Chromium uses internally
 *
 * @param  {String} langCode    The language code to normalize
 *
 * @return {String}             The language code in Chromium format.
 */
function normalizeLanguageCode(langCode) {
  let result = parse(langCode.replace(/[_-]/g, '-'));
  if (!result || !result.langtag.language || !result.langtag.region) {
    throw new Error(`${langCode} is not a valid language code`);
  }

  return `${result.langtag.language.language.toLowerCase()}-${result.langtag.region.toUpperCase()}`;
}

module.exports = {
  normalizeLanguageCode
}
