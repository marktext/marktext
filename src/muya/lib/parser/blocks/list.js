import blockTokenizer from '../blockTokenizer'
import { replace } from '../utils'
import { blockProcesserFac } from '../blockProcesser'
import { CLASS_OR_ID } from '../../config'
const rules = {
  def: /^ {0,3}\[([^\]]+)\]: *<?([^\s>]+)>?(?: +["(]([^\n]+)[")])? *(?:\n+|$)/,
  tasklist: /^( *)([*+-] \[(?:X|x|\s)\]) [\s\S]+?(?:hr|def|\n{2,}(?! )(?!\1(?:[*+-] \[(?:X|x|\s)\]))\n*|\s*$)/,
  orderlist: /^( *)(\d+\.) [\s\S]+?(?:hr|def|\n{2,}(?! )(?!\1\d+\. )\n*|\s*$)/,
  bulletlist: /^( *)([*+-]) [\s\S]+?(?:hr|def|\n{2,}(?! )(?!\1[*+-] )\n*|\s*$)/,
  item: /^( *)(bull) [^\n]*(?:\n(?!\1bull )[^\n]*)*/,
  checkbox: /^\[([ x])\] +/,
  bullet: /(?:[*+-] \[(?:X|x|\s)\]|[*+-]|\d+\.)/
}
const meta = {
  id: 'list',
  type: 'block',
  sort: 20,
  rules: {
    tasklist: replace(rules.tasklist)('hr', '\\n+(?=\\1?(?:[-*_] *){3,}(?:\\n+|$))')('def', '\\n+(?=' + rules.def.source + ')')(),
    orderlist: replace(rules.orderlist)('hr', '\\n+(?=\\1?(?:[-*_] *){3,}(?:\\n+|$))')('def', '\\n+(?=' + rules.def.source + ')')(),
    bulletlist: replace(rules.bulletlist)('hr', '\\n+(?=\\1?(?:[-*_] *){3,}(?:\\n+|$))')('def', '\\n+(?=' + rules.def.source + ')')(),
    item: replace(rules.item, 'gm')(/bull/g, rules.bullet)()
  }
}

function parse (params) {
  let cap = meta.rules.tasklist.exec(params.src) || meta.rules.orderlist.exec(params.src) || meta.rules.bulletlist.exec(params.src)
  let ok = false
  let bull, l, i, item, space, checked, b, loose
  if (cap) {
    ok = true
    params.src = params.src.substring(cap[0].length)
    bull = cap[2]
    const ordered = bull.length > 1 && /\d/.test(bull)

    params.tokens.push({
      type: 'list_start',
      ordered,
      listType: bull.length > 1 ? (/\d/.test(bull) ? 'order' : 'task') : 'bullet',
      start: ordered ? +bull : ''
    })

    let next = false
    let prevNext = true
    let listItemIndices = []

    // Get each params.top-level item.
    cap = cap[0].match(meta.rules.item)
    l = cap.length
    i = 0

    for (; i < l; i++) {
      const itemWithBullet = cap[i]
      item = itemWithBullet

      // Remove the list item's bullet
      // so it is seen as the next token.
      space = item.length
      item = item.replace(/^ *([*+-]|\d+\.) +/, '')

      if (params.options.gfm) {
        checked = rules.checkbox.exec(item)
        if (checked) {
          checked = checked[1] === 'x'
          item = item.replace(rules.checkbox, '')
        } else {
          checked = undefined
        }
      }

      // Outdent whatever the
      // list item contains. Hacky.
      if (~item.indexOf('\n ')) {
        space -= item.length
        item = !params.options.pedantic
          ? item.replace(new RegExp('^ {1,' + space + '}', 'gm'), '')
          : item.replace(/^ {1,4}/gm, '')
      }

      // Determine whether the next list item belongs here.
      // Backpedal if it does not belong in this list.
      if (params.options.smartLists && i !== l - 1) {
        b = rules.bullet.exec(cap[i + 1])[0]
        if (bull !== b && !(bull.length > 1 && b.length > 1)) {
          params.src = cap.slice(i + 1).join('\n') + params.src
          i = l - 1
        }
      }

      let prevItem = ''
      if (i === 0) {
        prevItem = item
      } else {
        prevItem = cap[i - 1]
      }

      // Determine whether item is loose or not. If previous item is loose
      // this item is also loose.
      loose = next = next || /^ *([*+-]|\d+\.) +\S+\n\n(?!\s*$)/.test(itemWithBullet)

      // Check if previous line ends with a new line.
      if (!loose && (i !== 0 || l > 1) && prevItem.length !== 0 && prevItem.charAt(prevItem.length - 1) === '\n') {
        loose = next = true
      }

      // A list is either loose or tight, so update previous list items.
      if (next && prevNext !== next) {
        for (const index of listItemIndices) {
          params.tokens[index].type = 'loose_item_start'
        }
        listItemIndices = []
      }
      prevNext = next

      if (!loose) {
        listItemIndices.push(params.tokens.length)
      }

      params.tokens.push({
        checked: checked,
        listItemType: bull.length > 1 ? (/\d/.test(bull) ? 'order' : 'task') : 'bullet',
        bulletListItemMarker: /\d/.test(bull) ? '' : bull.charAt(0),
        type: loose ? 'loose_item_start' : 'list_item_start'
      })

      // Recurse.
      params.tokens.push(...blockTokenizer(item, params.options, params.beginBlocks, params.notBeginBlocks, false, params.bq))
      params.tokens.push({
        type: 'list_item_end'
      })
    }

    params.tokens.push({
      type: 'list_end'
    })
  }

  return { ok, params }
}
function process (params) {
  // good
  let cap = meta.rules.tasklist.exec(params.src) || meta.rules.orderlist.exec(params.src) || meta.rules.bulletlist.exec(params.src)
  let ok = false
  let bull, l, i, item, space, checked, b, loose
  let block, child
  if (cap) {
    ok = true
    params.src = params.src.substring(cap[0].length)
    bull = cap[2]
    const ordered = bull.length > 1 && /\d/.test(bull)
    const listType = bull.length > 1 ? (/\d/.test(bull) ? 'order' : 'task') : 'bullet'
    const start = ordered ? +bull : ''
    if (listType === 'order') {
      block = params.stateRender.createBlock('ol', '', {
        selector: `${CLASS_OR_ID['AG_ORDER_LIST']}`,
        attrs: {}
      })
      block.start = start
      if (!block.start) {
        block.start = 1
      }
      block.attrs.start = block.start
    } else {
      block = params.stateRender.createBlock('ul', '', {
        selector: listType === 'task' ? `.${CLASS_OR_ID['AG_TASK_LIST']}` : `.${CLASS_OR_ID['AG_BULLET_LIST']}`
      })
    }
    block.listType = listType

    // Get each params.top-level item.
    cap = cap[0].match(meta.rules.item)
    l = cap.length
    i = 0

    for (; i < l; i++) {
      const itemWithBullet = cap[i]
      item = itemWithBullet

      // Remove the list item's bullet
      // so it is seen as the next token.
      space = item.length
      item = item.replace(/^ *([*+-]|\d+\.) +/, '')

      if (params.options.gfm) {
        checked = rules.checkbox.exec(item)
        if (checked) {
          checked = checked[1] === 'x'
          item = item.replace(rules.checkbox, '')
        } else {
          checked = undefined
        }
      }

      // Outdent whatever the
      // list item contains. Hacky.
      if (~item.indexOf('\n ')) {
        space -= item.length
        item = !params.options.pedantic
          ? item.replace(new RegExp('^ {1,' + space + '}', 'gm'), '')
          : item.replace(/^ {1,4}/gm, '')
      }

      // Determine whether the next list item belongs here.
      // Backpedal if it does not belong in this list.
      if (params.options.smartLists && i !== l - 1) {
        b = rules.bullet.exec(cap[i + 1])[0]
        if (bull !== b && !(bull.length > 1 && b.length > 1)) {
          params.src = cap.slice(i + 1).join('\n') + params.src
          i = l - 1
        }
      }

      let listItemType = bull.length > 1 ? (/\d/.test(bull) ? 'order' : 'task') : 'bullet'
      let isLooseListItem = loose
      let bulletListItemMarker = /\d/.test(bull) ? '' : bull.charAt(0)
      let selector = ''
      selector += `.${CLASS_OR_ID['AG_LIST_ITEM']}`
      switch (listItemType) {
        case 'order':
          selector += `.${CLASS_OR_ID['AG_ORDER_LIST_ITEM']}`
          break
        case 'bullet':
          selector += `.${CLASS_OR_ID['AG_BULLET_LIST_ITEM']}`
          break
        case 'task':
          selector += `.${CLASS_OR_ID['AG_TASK_LIST_ITEM']}`
          break
        default:
          break
      }
      selector += isLooseListItem ? `.${CLASS_OR_ID['AG_LOOSE_LIST_ITEM']}` : `.${CLASS_OR_ID['AG_TIGHT_LIST_ITEM']}`

      child = params.stateRender.createBlock('li', '', {
        selector: selector,
        dataset: {
          marker: bulletListItemMarker
        }
      })
      child.listItemType = listItemType
      child.isLooseListItem = isLooseListItem
      child.bulletListItemMarker = bulletListItemMarker
      params.stateRender.appendChild(block, child)
      blockProcesserFac(item, child, params.stateRender, params.options, params.beginBlocks, params.notBeginBlocks, false, params.bq)
    }
    params.stateRender.appendChild(params.parent, block)
  }

  return { ok, params }
}
export default { meta, parse, process }
