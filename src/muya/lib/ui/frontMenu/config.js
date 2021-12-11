import copyIcon from '../../assets/pngicon/copy/2.png'
import newIcon from '../../assets/pngicon/paragraph/2.png'
import deleteIcon from '../../assets/pngicon/delete/2.png'
import turnIcon from '../../assets/pngicon/turninto/2.png'
import { isOsx } from '../../config'
import { quickInsertObj } from '../quickInsert/config'
import i18n from '../../i18n'

const wholeSubMenu = Object.keys(quickInsertObj).reduce((acc, key) => {
  const items = quickInsertObj[key]
  return [...acc, ...items]
}, [])

const COMMAND_KEY = isOsx ? '⌘' : '⌃'

export const menu = [{
  icon: copyIcon,
  label: 'duplicate',
  text: i18n.t('menu.edit.duplicate'),
  shortCut: `⇧${COMMAND_KEY}P`
}, {
  icon: turnIcon,
  label: 'turnInto',
  text: i18n.t('menu.paragraph.turnInto')
}, {
  icon: newIcon,
  label: 'new',
  text: i18n.t('menu.paragraph.newParagraph'),
  shortCut: `⇧${COMMAND_KEY}N`
}, {
  icon: deleteIcon,
  label: 'delete',
  text: i18n.t('menu.edit.delete'),
  shortCut: `⇧${COMMAND_KEY}D`
}]

export const getLabel = block => {
  const { type, functionType, listType } = block
  let label = ''
  switch (type) {
    case 'p': {
      label = 'paragraph'
      break
    }
    case 'figure': {
      if (functionType === 'table') {
        label = 'table'
      } else if (functionType === 'html') {
        label = 'html'
      } else if (functionType === 'multiplemath') {
        label = 'mathblock'
      }
      break
    }
    case 'pre': {
      if (functionType === 'fencecode' || functionType === 'indentcode') {
        label = 'pre'
      } else if (functionType === 'frontmatter') {
        label = 'front-matter'
      }
      break
    }
    case 'ul': {
      if (listType === 'task') {
        label = 'ul-task'
      } else {
        label = 'ul-bullet'
      }
      break
    }
    case 'ol': {
      label = 'ol-order'
      break
    }
    case 'blockquote': {
      label = 'blockquote'
      break
    }
    case 'h1': {
      label = 'heading 1'
      break
    }
    case 'h2': {
      label = 'heading 2'
      break
    }
    case 'h3': {
      label = 'heading 3'
      break
    }
    case 'h4': {
      label = 'heading 4'
      break
    }
    case 'h5': {
      label = 'heading 5'
      break
    }
    case 'h6': {
      label = 'heading 6'
      break
    }
    case 'hr': {
      label = 'hr'
      break
    }
    default:
      label = 'paragraph'
      break
  }
  return label
}

export const getSubMenu = (block, startBlock, endBlock) => {
  const { type } = block
  switch (type) {
    case 'p': {
      return wholeSubMenu.filter(menuItem => {
        const REG_EXP = startBlock.key === endBlock.key
          ? /front-matter|hr|table/
          : /front-matter|hr|table|heading/

        return !REG_EXP.test(menuItem.label)
      })
    }
    case 'h1':
    case 'h2':
    case 'h3':
    case 'h4':
    case 'h5':
    case 'h6': {
      return wholeSubMenu.filter(menuItem => {
        return /heading|paragraph/.test(menuItem.label)
      })
    }
    case 'ul':
    case 'ol': {
      return wholeSubMenu.filter(menuItem => {
        return /ul|ol/.test(menuItem.label)
      })
    }
    default:
      return []
  }
}
