import { deflate } from 'pako'
import { toHTML, h } from './snabbdom'

const PLANTUML_DEFAULT_URL = 'https://www.plantuml.com/plantuml'

function replaceChar(tableIn, tableOut, char) {
  const charIndex = tableIn.indexOf(char)
  return tableOut[charIndex]
}

function maketrans(tableIn, tableOut, value) {
  return [...value].map(i => replaceChar(tableIn, tableOut, i)).join('')
}

// Encode a Uint8Array as a base64 string without leaning on Node's Buffer.
function uint8ArrayToBase64(bytes) {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

export default class Diagram {
  encodedInput = ''
  plantumlServer = PLANTUML_DEFAULT_URL

  static parse(input, plantumlServer) {
    const diagram = new Diagram()
    diagram.encodedInput = Diagram.encode(input)
    if (plantumlServer) {
      diagram.plantumlServer = plantumlServer
    }
    return diagram
  }

  static encode(value) {
    const tableIn =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
    const tableOut =
      '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_'

    const utf8Value = decodeURIComponent(encodeURIComponent(value))
    const bytes = new TextEncoder().encode(utf8Value)
    const compressed = deflate(bytes, { level: 3 })
    const base64Value = uint8ArrayToBase64(compressed)
    return maketrans(tableIn, tableOut, base64Value)
  }

  insertImgElement(container) {
    const div = typeof container === 'string'
      ? document.getElementById(container)
      : container
    if (div === null || !div.tagName) {
      throw new Error('Invalid container: ' + container)
    }
    const src = `${this.plantumlServer}/svg/~1${this.encodedInput}`
    const node = h('img', { attrs: { src } })
    div.innerHTML = toHTML(node)
  }
}
