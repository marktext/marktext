import { CLASS_OR_ID } from '../../config'
import { highlight, getClassName, pushPending } from '../utils/'
import { escapeCharacters, escapeCharactersMap } from '../utils/escapeCharacter'
const meta = {
  id: 'htmlEscape',
  type: 'inline',
  sort: 200,
  rule: new RegExp(`^(${escapeCharacters.join('|')})`, 'i')

}
function parse (params) {
  let cap = meta.rule.exec(params.src)
  let endPos = params.pos
  let ok = false
  if (cap) {
    ok = true
    pushPending(params)
    params.src = params.src.substring(cap[0].length)
    endPos = params.pos + cap[0].length
    params.tokens.push({
      raw: cap[0],
      escapeCharacter: cap[1],
      type: meta.id,
      parent: params.tokens,
      range: {
        start: params.pos,
        end: endPos
      }
    })
    params.pos = endPos
  }
  return { ok, params }
}

function render (h, cursor, block, token, outerClass) {
  const className = getClassName(outerClass, block, token, cursor)
  const { escapeCharacter } = token
  const { start, end } = token.range

  const content = highlight(h, block, start, end, token)

  return [
    h(`span.${className}.${CLASS_OR_ID['AG_HTML_ESCAPE']}`, {
      dataset: {
        character: escapeCharactersMap[escapeCharacter]
      }
    }, content)
  ]
}
export default { meta, parse, render }
