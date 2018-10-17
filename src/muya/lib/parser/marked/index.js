import Renderer from './renderer'
import Lexer from './lexer'
import Parser from './parser'
import { options } from './utils'

/**
 * Marked
 */

function marked (src, opt = {}) {
  try {
    opt = Object.assign({}, options, opt)
    return new Parser(opt).parse(new Lexer(opt).lex(src))
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
  Renderer, Lexer, Parser
}

export default marked
