import { escapeCharacters } from './escapeCharacter'

/* eslint-disable no-useless-escape */
export const beginRules = {
  'hr': /^(\*{3,}$|^\-{3,}$|^\_{3,}$)/,
  'code_fense': /^(`{3,})([^`]*)$/,
  'header': /(^\s{0,3}#{1,6}(\s{1,}|$))/,
  'reference_definition': /^( {0,3}\[)([^\]]+?)(\\*)(\]: *)(<?)([^\s>]+)(>?)(?:( +)(["'(]?)([^\n"'\(\)]+)\9)?( *)$/,

  // extra syntax (not belogs to GFM)
  'multiple_math': /^(\$\$)$/
}

export const inlineRules = {
  'strong': /^(\*\*|__)(?=\S)([\s\S]*?[^\s\\])(\\*)\1(?!(\*|_))/, // can nest
  'em': /^(\*|_)(?=\S)([\s\S]*?[^\s\*\\])(\\*)\1(?!\1)/, // can nest
  'inline_code': /^(`{1,3})([^`]+?|.{2,})\1/,
  'image': /^(\!\[)(.*?)(\\*)\]\((.*?)(\\*)\)/,
  'link': /^(\[)((?:\[[^\]]*\]|[^\[\]]|\](?=[^\[]*\]))*?)(\\*)\]\((.*?)(\\*)\)/, // can nest
  'emoji': /^(:)([a-z_]+?)\1/,
  'del': /^(~{2})(?=\S)([\s\S]*?\S)(\\*)\1/, // can nest
  'auto_link': /^(https?:\/\/[^\s]+)(?=\s|$)/,
  'reference_link': /^\[([^\]]+?)(\\*)\](?:\[([^\]]*?)(\\*)\])?/,
  'reference_image': /^\!\[([^\]]+?)(\\*)\](?:\[([^\]]*?)(\\*)\])?/,
  'tail_header': /^(\s{1,}#{1,})(\s*)$/,
  'html_tag': /^(<!--[\s\S]*?-->|(<([a-zA-Z]{1}[a-zA-Z\d-]*) *[_\.\-/:a-zA-Z\d='";\? ]* *(?:\/)?>)(?:([\s\S]*?)(<\/\3 *>))?)/, // row html
  'html_escape': new RegExp(`^(${escapeCharacters.join('|')})`, 'i'),
  'hard_line_break': /^(\s{2,})$/,

  // patched math marker `$`
  'backlash': /^(\\)([\\`*{}\[\]()#+\-.!_>~:\|\<\>$]{1})/,

  // extra (not belongs to GFM)
  'inline_math': /^(\$)([^\$]*?[^\$\\])(\\*)\1(?!\1)/
}
/* eslint-enable no-useless-escape */
