import { escapeCharacters } from './escapeCharacter'

/* eslint-disable no-useless-escape */
export const beginRules = {
  'hr': /^(\*{3,}$|^\-{3,}$|^\_{3,}$)/,
  'code_fense': /^(`{3,})([^`]*)$/,
  'header': /(^\s{0,3}#{1,6}(\s{1,}|$))/,
  'display_math': /^(\$\$)([^\$]*?[^\$\\])(\\*)\1$/,
  'multiple_math': /^(\$\$)$/
}

export const inlineRules = {
  'backlash': /^(\\)([\\`*{}\[\]()#+\-.!_>~:\|\<\>]{1})/,
  'strong': /^(\*\*|__)(?=\S)([\s\S]*?[^\s\*\\])(\\*)\1(?!(\*|_))/, // can nest
  'em': /^(\*|_)(?=\S)([\s\S]*?[^\s\*\\])(\\*)\1(?!\1)/, // can nest
  'inline_code': /^(`{1,3})([^`]+?|.{2,})\1/,
  'image': /^(\!\[)(.*?)(\\*)\]\((.*?)(\\*)\)/,
  'link': /^(\[)((?:\[[^\]]*\]|[^\[\]]|\](?=[^\[]*\]))*?)(\\*)\]\((.*?)(\\*)\)/, // can nest
  'emoji': /^(:)([a-z_]+?)\1/,
  'del': /^(~{2})(?=\S)([\s\S]*?\S)(\\*)\1/, // can nest
  'auto_link': /^(https?:\/\/[^\s]+)(?=\s|$)/,
  'inline_math': /^(\$)([^\$]*?[^\$\\])(\\*)\1(?!\1)/,
  'tail_header': /^(\s{1,}#{1,})(\s*)$/,
  'a_link': /^(<a[\s\S]*href\s*=\s*("|')(.+?)\2(?=\s|>)[\s\S]*(?!\\)>)([\s\S]*)(<\/a>)/, // can nest
  'html_image': /^(<img\s([\s\S]*?src[\s\S]+?)(?!\\)>)/,
  'html_tag': /^(<!--[\s\S]*?-->|<\/?[a-zA-Z\d-]+[\s\S]*?(?!\\)>)/,
  'html_escape': new RegExp(`^(${escapeCharacters.join('|')})`, 'i'),
  'hard_line_break': /^(\s{2,})$/
}
/* eslint-enable no-useless-escape */
