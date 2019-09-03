import { CLASS_OR_ID } from '../../../config'
import { renderTableTools } from './renderToolBar'
import { renderEditIcon } from './renderContainerEditIcon'
import { h } from '../snabbdom'

const PRE_BLOCK_HASH = {
  fencecode: `.${CLASS_OR_ID.AG_FENCE_CODE}`,
  indentcode: `.${CLASS_OR_ID.AG_INDENT_CODE}`,
  html: `.${CLASS_OR_ID.AG_HTML_BLOCK}`,
  frontmatter: `.${CLASS_OR_ID.AG_FRONT_MATTER}`,
  multiplemath: `.${CLASS_OR_ID.AG_MULTIPLE_MATH}`,
  flowchart: `.${CLASS_OR_ID.AG_FLOWCHART}`,
  sequence: `.${CLASS_OR_ID.AG_SEQUENCE}`,
  mermaid: `.${CLASS_OR_ID.AG_MERMAID}`,
  'vega-lite': `.${CLASS_OR_ID.AG_VEGA_LITE}`
}

export default function renderContainerBlock (block, activeBlocks, matches, useCache = false) {
  let selector = this.getSelector(block, activeBlocks)
  const {
    type,
    headingStyle,
    editable,
    functionType,
    listType,
    listItemType,
    bulletMarkerOrDelimiter,
    isLooseListItem,
    lang
  } = block
  const children = block.children.map(child => this.renderBlock(child, activeBlocks, matches, useCache))
  const data = {
    attrs: {},
    dataset: {}
  }

  if (editable === false) {
    Object.assign(data.attrs, { contenteditable: 'false' })
  }

  if (/code|pre/.test(type) && typeof lang === 'string' && !!lang) {
    selector += `.language-${lang.replace(/[#.]{1}/g, '')}`
  }

  if (/^h/.test(type)) {
    if (/^h\d$/.test(type)) {
      // TODO: This should be the best place to create and update the TOC.
      //       Cache `block.key` and title and update only if necessary.
      Object.assign(data.dataset, {
        head: type
      })
      selector += `.${headingStyle}`
    }
    Object.assign(data.dataset, {
      role: type
    })
  } else if (type === 'figure') {
    if (functionType) {
      Object.assign(data.dataset, { role: functionType.toUpperCase() })
      if (functionType === 'table') {
        children.unshift(renderTableTools(activeBlocks))
      } else {
        children.unshift(renderEditIcon())
      }
    }

    if (
      /html|multiplemath|flowchart|mermaid|sequence|vega-lite/.test(functionType)
    ) {
      selector += `.${CLASS_OR_ID.AG_CONTAINER_BLOCK}`
    }
  } else if (/ul|ol/.test(type) && listType) {
    selector += `.ag-${listType}-list`
    if (type === 'ol') {
      Object.assign(data.attrs, { start: block.start })
    }
  } else if (type === 'li' && listItemType) {
    Object.assign(data.dataset, { marker: bulletMarkerOrDelimiter })
    selector += `.${CLASS_OR_ID.AG_LIST_ITEM}`
    selector += `.ag-${listItemType}-list-item`
    selector += isLooseListItem ? `.${CLASS_OR_ID.AG_LOOSE_LIST_ITEM}` : `.${CLASS_OR_ID.AG_TIGHT_LIST_ITEM}`
  } else if (type === 'pre') {
    Object.assign(data.dataset, { role: functionType })
    selector += PRE_BLOCK_HASH[block.functionType]

    if (/html|multiplemath|mermaid|flowchart|vega-lite|sequence/.test(functionType)) {
      const codeBlock = block.children[0]
      const code = codeBlock.children.map(line => line.text).join('\n')
      this.codeCache.set(block.key, code)
    }
  }

  if (!block.parent) {
    children.unshift(this.renderIcon(block))
  }

  return h(selector, data, children)
}
