import { h } from '../snabbdom'
import { CLASS_OR_ID } from '../../../config'
import paragraphIcon from '../../../assets/icons/paragraph.svg'
import htmlIcon from '../../../assets/icons/html.svg'
import hrIcon from '../../../assets/icons/horizontal_line.svg'
import frontMatterIcon from '../../../assets/icons/front_matter.svg'
import header1Icon from '../../../assets/icons/header_1.svg'
import header2Icon from '../../../assets/icons/header_2.svg'
import header3Icon from '../../../assets/icons/header_3.svg'
import header4Icon from '../../../assets/icons/header_4.svg'
import header5Icon from '../../../assets/icons/header_5.svg'
import header6Icon from '../../../assets/icons/header_6.svg'
import newTableIcon from '../../../assets/icons/new_table.svg'
import bulletListIcon from '../../../assets/icons/bullet_list.svg'
import codeIcon from '../../../assets/icons/code.svg'
import quoteIcon from '../../../assets/icons/quote.svg'
import todoListIcon from '../../../assets/icons/todolist.svg'
import mathblockIcon from '../../../assets/icons/math.svg'
import orderListIcon from '../../../assets/icons/order_list.svg'
import flowchartIcon from '../../../assets/icons/flowchart.svg'
import sequenceIcon from '../../../assets/icons/sequence.svg'
import mermaidIcon from '../../../assets/icons/mermaid.svg'
import vegaIcon from '../../../assets/icons/chart.svg'

const FUNCTION_TYPE_HASH = {
  'mermaid': mermaidIcon,
  'flowchart': flowchartIcon,
  'sequence': sequenceIcon,
  'vega-lite': vegaIcon,
  'table': newTableIcon,
  'html': htmlIcon,
  'multiplemath': mathblockIcon,
  'fencecode': codeIcon,
  'indentcode': codeIcon,
  'frontmatter': frontMatterIcon
}

export default function renderIcon (block) {
  if (block.parent) {
    console.error('Only top most block can render front icon button.')
  }
  const { type, functionType, listType } = block
  const selector = `a.${CLASS_OR_ID['AG_FRONT_ICON']}`
  let icon = null

  switch (type) {
    case 'p': {
      icon = paragraphIcon
      break
    }
    case 'figure':
    case 'pre': {
      icon = FUNCTION_TYPE_HASH[functionType]
      if (!icon) {
        console.warn(`Unhandled functionType ${functionType}`)
        icon = paragraphIcon
      }
      break
    }
    case 'ul': {
      if (listType === 'task') {
        icon = todoListIcon
      } else {
        icon = bulletListIcon
      }
      break
    }
    case 'ol': {
      icon = orderListIcon
      break
    }
    case 'blockquote': {
      icon = quoteIcon
      break
    }
    case 'h1': {
      icon = header1Icon
      break
    }
    case 'h2': {
      icon = header2Icon
      break
    }
    case 'h3': {
      icon = header3Icon
      break
    }
    case 'h4': {
      icon = header4Icon
      break
    }
    case 'h5': {
      icon = header5Icon
      break
    }
    case 'h6': {
      icon = header6Icon
      break
    }
    case 'hr': {
      icon = hrIcon
      break
    }
    default:
      icon = paragraphIcon
      break
  }

  const children = [
    h('use', {
      attrs: {
        'xlink:href': `${icon.url}`
      }
    })
  ]

  const svg = h('svg', {
    attrs: {
      'viewBox': icon.viewBox,
      'aria-hidden': 'true'
    }
  }, children)

  return h(selector, {
    attrs: {
      contenteditable: 'false'
    }
  }, svg)
}
