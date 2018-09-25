import { replace, checkIsHTML } from '../utils'
import { blockProcesserFac } from '../blockProcesser'
const rules = {
  paragraph: /^((?:[^\n]+\n?(?!hr|heading|lheading|blockquote|tag|def))+)\n*/,
  def: /^ {0,3}\[([^\]]+)\]: *<?([^\s>]+)>?(?: +["(]([^\n]+)[")])? *(?:\n+|$)/,
  tasklist: /^( *)([*+-] \[(?:X|x|\s)\]) [\s\S]+?(?:hr|def|\n{2,}(?! )(?!\1(?:[*+-] \[(?:X|x|\s)\]))\n*|\s*$)/,
  orderlist: /^( *)(\d+\.) [\s\S]+?(?:hr|def|\n{2,}(?! )(?!\1\d+\. )\n*|\s*$)/,
  bulletlist: /^( *)([*+-]) [\s\S]+?(?:hr|def|\n{2,}(?! )(?!\1[*+-] )\n*|\s*$)/,
  fences: /^ *(`{3,}|~{3,})[ \.]*(\S+)? *\n([\s\S]+?)\s*\1 *(?:\n+|$)/ //eslint-disable-line

}

const rules2 = {
  tasklist: replace(rules.tasklist)('hr', '\\n+(?=\\1?(?:[-*_] *){3,}(?:\\n+|$))')('def', '\\n+(?=' + rules.def.source + ')')(),
  orderlist: replace(rules.orderlist)('hr', '\\n+(?=\\1?(?:[-*_] *){3,}(?:\\n+|$))')('def', '\\n+(?=' + rules.def.source + ')')(),
  bulletlist: replace(rules.bulletlist)('hr', '\\n+(?=\\1?(?:[-*_] *){3,}(?:\\n+|$))')('def', '\\n+(?=' + rules.def.source + ')')()

}
const meta = {
  id: 'paragraph',
  type: 'block',
  sort: 200,
  rule: replace(rules.paragraph)('(?!', '(?!' +
    rules.fences.source.replace('\\1', '\\2') + '|' +
    rules2.tasklist.source.replace('\\1', '\\5') + '|' +
    rules2.orderlist.source.replace('\\1', '\\7') + '|' +
    rules2.bulletlist.source.replace('\\1', '\\9') + '|')()
}

function parse (params) {
  let cap = meta.rule.exec(params.src)
  let ok = false
  if (cap && params.top) {
    ok = true
    params.src = params.src.substring(cap[0].length)
    params.tokens.push({
      type: meta.id,
      text: cap[1].charAt(cap[1].length - 1) === '\n'
        ? cap[1].slice(0, -1)
        : cap[1]
    })
  }
  return { ok, params }
}
function process (params) {
  let cap = meta.rule.exec(params.src)
  let ok = false
  if (cap && params.top) {
    ok = true
    params.src = params.src.substring(cap[0].length)

    const value = cap[1].charAt(cap[1].length - 1) === '\n' ? cap[1].slice(0, -1) : cap[1]

    if (checkIsHTML(value)) {
      blockProcesserFac(value, params.parent, params.stateRender, params.options, params.beginBlocks, params.notBeginBlocks, false, false)
    } else {
      const pBlock = params.stateRender.createBlock('p')
      blockProcesserFac(value, pBlock, params.stateRender, params.options, params.beginBlocks, params.notBeginBlocks, false, false)
      params.stateRender.appendChild(params.parent, pBlock)
    }
  }
  return { ok, params }
}
export default { meta, parse, process }
