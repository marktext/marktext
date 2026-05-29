import copyIcon from '../../assets/pngicon/copy/2.png'
import newIcon from '../../assets/pngicon/paragraph/2.png'
import deleteIcon from '../../assets/pngicon/delete/2.png'
import turnIcon from '../../assets/pngicon/turninto/2.png'
import { isOsx } from '../../config'
import { createQuickInsertObj } from '../quickInsert/config'

// Creates a function to generate the submenu, accepting a translation function as a parameter
const createWholeSubMenu = (t) => {
  const quickInsertObj = createQuickInsertObj(t)
  return Object.keys(quickInsertObj).reduce((acc, key) => {
    const items = quickInsertObj[key]
    return [...acc, ...items]
  }, [])
}

const COMMAND_KEY = isOsx ? '⌘' : '⌃'

// Function to create the menu, accepting a translation function as a parameter
export const createMenu = (t) => {
  // If no translation function is provided, return the key name directly
  const translate = t || ((key) => key)

  return [
    {
      icon: copyIcon,
      label: 'duplicate',
      text: translate('frontMenu.duplicate'),
      shortCut: `⇧${COMMAND_KEY}P`
    },
    {
      icon: turnIcon,
      label: 'turnInto',
      text: translate('frontMenu.turnInto')
    },
    {
      icon: newIcon,
      label: 'new',
      text: translate('frontMenu.newParagraph'),
      shortCut: `⇧${COMMAND_KEY}N`
    },
    {
      icon: deleteIcon,
      label: 'delete',
      text: translate('frontMenu.delete'),
      shortCut: `⇧${COMMAND_KEY}D`
    }
  ]
}

// Retained for backward compatibility as the default menu export
export const menu = createMenu()

// Create the getLabel function, accepting a translation function as a parameter
export const createGetLabel = (t) => {
  // If no translation function is provided, return the key name directly
  const translate = t || ((key) => key)

  return (block) => {
    const { type, functionType, listType } = block
    let label = ''
    switch (type) {
      case 'p': {
        label = translate('frontMenu.paragraph')
        break
      }
      case 'figure': {
        if (functionType === 'table') {
          label = translate('frontMenu.table')
        } else if (functionType === 'html') {
          label = translate('frontMenu.html')
        } else if (functionType === 'multiplemath') {
          label = translate('frontMenu.mathblock')
        }
        break
      }
      case 'pre': {
        if (functionType === 'fencecode' || functionType === 'indentcode') {
          label = translate('frontMenu.pre')
        } else if (functionType === 'frontmatter') {
          label = translate('frontMenu.frontMatter')
        }
        break
      }
      case 'ul': {
        if (listType === 'task') {
          label = translate('frontMenu.ulTask')
        } else {
          label = translate('frontMenu.ulBullet')
        }
        break
      }
      case 'ol': {
        label = translate('frontMenu.olOrder')
        break
      }
      case 'blockquote': {
        label = translate('frontMenu.blockquote')
        break
      }
      case 'h1': {
        label = translate('frontMenu.heading1')
        break
      }
      case 'h2': {
        label = translate('frontMenu.heading2')
        break
      }
      case 'h3': {
        label = translate('frontMenu.heading3')
        break
      }
      case 'h4': {
        label = translate('frontMenu.heading4')
        break
      }
      case 'h5': {
        label = translate('frontMenu.heading5')
        break
      }
      case 'h6': {
        label = translate('frontMenu.heading6')
        break
      }
      case 'hr': {
        label = translate('frontMenu.hr')
        break
      }
      default:
        label = translate('frontMenu.paragraph')
        break
    }
    return label
  }
}

// Retained for backward compatibility; export the default getLabel
export const getLabel = createGetLabel()

export const createGetSubMenu = (t) => {
  const wholeSubMenu = createWholeSubMenu(t)

  return (block, startBlock, endBlock) => {
    const { type } = block
    switch (type) {
      case 'p': {
        return wholeSubMenu.filter((menuItem) => {
          const REG_EXP =
            startBlock.key === endBlock.key
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
        return wholeSubMenu.filter((menuItem) => {
          return /heading|paragraph/.test(menuItem.label)
        })
      }
      case 'ul':
      case 'ol': {
        return wholeSubMenu.filter((menuItem) => {
          return /ul|ol/.test(menuItem.label)
        })
      }
      default:
        return []
    }
  }
}

// Create the default getSubMenu function
export const getSubMenu = createGetSubMenu()
