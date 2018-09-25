import Renderer from './renderer'
import blockTokenizer from '../blockTokenizer'
import Parser from './parser'
import { getBeginBlocks, getNotBeginBlocks } from '../blocks'

const defaults = {
  gfm: true,
  tables: true,
  breaks: false,
  pedantic: false,
  sanitize: false,
  sanitizer: null,
  mangle: true,
  smartLists: false,
  silent: false,
  highlight: null,
  langPrefix: 'lang-',
  smartypants: false,
  headerPrefix: '',
  renderer: new Renderer(),
  xhtml: false,
  disableInline: false
}
/**
 * Marked
 */

function marked (src, opt = {}) {
  try {
    opt = Object.assign({}, defaults, opt)
    return new Parser(opt).parse(blockTokenizer(src, opt, getBeginBlocks(opt), getNotBeginBlocks(opt), true, false))
  } catch (e) {
    e.message += '\nPlease report this to https://github.com/marktext/marktext/issues.'
    if (opt.silent) {
      return '<p>An error occurred:</p><pre>' +
        escape(e.message + '', true) +
        '</pre>'
    }
    throw e
  }
}

export {
  Renderer, Parser
}

export default marked
