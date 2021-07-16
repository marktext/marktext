export const ENCODING_NAME_MAP = Object.freeze({
  utf8: 'UTF-8',
  utf16be: 'UTF-16 BE',
  utf16le: 'UTF-16 LE',
  utf32be: 'UTF-32 BE',
  utf32le: 'UTF-32 LE',
  ascii: 'Western (ISO 8859-1)',
  latin3: 'Western (ISO 8859-3)',
  iso885915: 'Western (ISO 8859-15)',
  cp1252: 'Western (Windows 1252)',
  arabic: 'Arabic (ISO 8859-6)',
  cp1256: 'Arabic (Windows 1256)',
  latin4: 'Baltic (ISO 8859-4)',
  cp1257: 'Baltic (Windows 1257)',
  iso88592: 'Central European (ISO 8859-2)',
  windows1250: 'Central European (Windows 1250)',
  cp866: 'Cyrillic (CP 866)',
  iso88595: 'Cyrillic (ISO 8859-5)',
  koi8r: 'Cyrillic (KOI8-R)',
  koi8u: 'Cyrillic (KOI8-U)',
  cp1251: 'Cyrillic (Windows 1251)',
  iso885913: 'Estonian (ISO 8859-13)',
  greek: 'Greek (ISO 8859-7)',
  cp1253: 'Greek (Windows 1253)',
  hebrew: 'Hebrew (ISO 8859-8)',
  cp1255: 'Hebrew (Windows 1255)',
  latin5: 'Turkish (ISO 8859-9)',
  cp1254: 'Turkish (Windows 1254)',
  gb2312: 'Simplified Chinese (GB2312)',
  gb18030: 'Simplified Chinese (GB18030)',
  gbk: 'Simplified Chinese (GBK)',
  big5: 'Traditional Chinese (Big5)',
  big5hkscs: 'Traditional Chinese (Big5-HKSCS)',
  shiftjis: 'Japanese (Shift JIS)',
  eucjp: 'Japanese (EUC-JP)',
  euckr: 'Korean (EUC-KR)',
  latin6: 'Nordic (ISO 8859-10)'
})

/**
 * Try to translate the encoding.
 *
 * @param {Encoding} enc The encoding object.
 */
export const getEncodingName = enc => {
  const { encoding, isBom } = enc
  let str = ENCODING_NAME_MAP[encoding] || encoding
  if (isBom) {
    str += ' with BOM'
  }
  return str
}
