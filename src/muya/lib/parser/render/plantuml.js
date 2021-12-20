import zlib from 'zlib'
import _ from 'underscore'
import { toHTML, h } from './snabbdom'

const PLANTUML_URL = 'https://www.plantuml.com/plantuml'

function replaceChar (tableIn, tableOut, char) {
  const charIndex = tableIn.indexOf(char)
  return tableOut[charIndex]
}

function maketrans (tableIn, tableOut, value) {
  return [...value].map(i => replaceChar(tableIn, tableOut, i)).join('')
}

export default class Diagram {
  encodedInput = '';

  /**
   * Builds a Diagram object storing the encoded input value
   */
  static parse (input) {
    const diagram = new Diagram()
    diagram.encodedInput = Diagram.encode(input)
    return diagram
  }

  /**
   * Encodes a diagram following PlantUML specs
   *
   * From https://plantuml.com/text-encoding
   * 1. Encoded in UTF-8
   * 2. Compressed using Deflate or Brotli algorithm
   * 3. Reencoded in ASCII using a transformation close to base64
   */
  static encode (value) {
    const tableIn =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
    const tableOut =
      '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_'

    const utf8Value = unescape(encodeURIComponent(value))
    const compressedValue = zlib.deflateSync(utf8Value, { level: 9 })
    const base64Value = compressedValue.toString('base64')
    return maketrans(tableIn, tableOut, base64Value)
  }

  insertImgElement (container, _options) {
    const div = _.isString(container)
      ? document.getElementById(container)
      : container
    if (div === null || !div.tagName) {
      throw new Error('Invalid container: ' + container)
    }
    const src = `${PLANTUML_URL}/svg/~1${this.encodedInput}`
    const node = h('img', { attrs: { src } })
    div.innerHTML = toHTML(node)
  }
}
