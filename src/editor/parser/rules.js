/* eslint-disable no-useless-escape */
export const beginRules = {
  'hr': /^(\*{3,}$|^\-{3,}$|^\_{3,}$)/,
  'code_fense': /^(`{3,})([^`]*)$/,
  'header': /(^#{1,6})/
}

export const inlineRules = {
  'backlash': /^(\\)([\\`*{}\[\]()#+\-.!_>~:])/,
  'strong': /^(\*{2}|_{2})([^\s]|[^\s].*?[^\s])(\\*)\1/, // can nest
  'em': /^(\*{1}|_{1})([^\s]|[^\s].*?[^\s])(\\*)\1/, // can nest
  'inline_code': /^(`{1,3})([^`]+?|.{2,})\1/,
  'image': /^(\!\[)(.*?)(\\*)\]\((.*?)(\\*)\)/,
  'link': /^(\[)((?:\[[^\]]*\]|[^\[\]]|\](?=[^\[]*\]))*?)(\\*)\]\((.*?)(\\*)\)/, // can nest
  'emoji': /^(:)([^:\\]+?)\1/,
  'del': /^(~{2})(?=\S)([\s\S]*?\S)(\\*)\1/, // can nest
  'auto_link': /^(https?:\/\/[^\s]+)(?=\s|$)/
}
/* eslint-enable no-useless-escape */
