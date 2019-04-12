import { CLASS_OR_ID } from '../../../config'
import { renderTableTools } from './renderToolBar'
import { h } from '../snabbdom'

const PRE_BLOCK_HASH = {
  'fencecode': `.${CLASS_OR_ID['AG_FENCE_CODE']}`,
  'indentcode': `.${CLASS_OR_ID['AG_INDENT_CODE']}`,
  'html': `.${CLASS_OR_ID['AG_HTML_BLOCK']}`,
  'frontmatter': `.${CLASS_OR_ID['AG_FRONT_MATTER']}`,
  'multiplemath': `.${CLASS_OR_ID['AG_MULTIPLE_MATH']}`,
  'flowchart': `.${CLASS_OR_ID['AG_FLOWCHART']}`,
  'sequence': `.${CLASS_OR_ID['AG_SEQUENCE']}`,
  'mermaid': `.${CLASS_OR_ID['AG_MERMAID']}`,
  'vega-lite': `.${CLASS_OR_ID['AG_VEGA_LITE']}`
}

export default function renderContainerBlock (block, cursor, activeBlocks, selectedBlock, matches, useCache = false) {
  let selector = this.getSelector(block, cursor, activeBlocks, selectedBlock)
  const children = block.children.map(child => this.renderBlock(child, cursor, activeBlocks, selectedBlock, matches, useCache))
  const data = {
    attrs: {},
    dataset: {}
  }
  // handle `div` block
  if (/div/.test(block.type)) {
    if (block.toolBarType) {
      selector += `.${'ag-tool-' + block.toolBarType}.${CLASS_OR_ID['AG_TOOL_BAR']}`
    }
    if (block.functionType) {
      selector += `.${'ag-function-' + block.functionType}`
    }
    if (block.editable !== undefined && !block.editable) {
      Object.assign(data.attrs, { contenteditable: 'false' })
    }
  }
  // handle `figure` block
  if (block.type === 'figure') {
    if (block.functionType) {
      Object.assign(data.dataset, { role: block.functionType.toUpperCase() })
      if (block.functionType === 'table') {
        children.unshift(renderTableTools(activeBlocks))
      }
    }

    if (
      /multiplemath|flowchart|mermaid|sequence|vega-lite/.test(block.functionType)
    ) {
      selector += `.${CLASS_OR_ID['AG_CONTAINER_BLOCK']}`
    }
  }
  // hanle list block
  if (/ul|ol/.test(block.type) && block.listType) {
    switch (block.listType) {
      case 'order':
        selector += `.${CLASS_OR_ID['AG_ORDER_LIST']}`
        break
      case 'bullet':
        selector += `.${CLASS_OR_ID['AG_BULLET_LIST']}`
        break
      case 'task':
        selector += `.${CLASS_OR_ID['AG_TASK_LIST']}`
        break
      default:
        break
    }
  }
  if (block.type === 'li' && block.listItemType) {
    selector += `.${CLASS_OR_ID['AG_LIST_ITEM']}`
    switch (block.listItemType) {
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
    Object.assign(data.dataset, { marker: block.bulletMarkerOrDelimiter })
    selector += block.isLooseListItem ? `.${CLASS_OR_ID['AG_LOOSE_LIST_ITEM']}` : `.${CLASS_OR_ID['AG_TIGHT_LIST_ITEM']}`
  }
  if (block.type === 'ol') {
    Object.assign(data.attrs, { start: block.start })
  }
  if (block.type === 'code') {
    const { lang } = block
    if (lang) {
      selector += `.language-${lang}`
    }
  }
  if (block.type === 'pre') {
    const { lang, functionType } = block
    if (lang) {
      selector += `.language-${lang}`
    }
    Object.assign(data.dataset, { role: functionType })
    selector += PRE_BLOCK_HASH[block.functionType]
  }

  if (!block.parent) {
    children.unshift(this.renderIcon(block))
  }

  return h(selector, data, children)
}
