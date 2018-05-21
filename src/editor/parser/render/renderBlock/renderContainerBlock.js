import { CLASS_OR_ID } from '../../../config'
import { h } from '../snabbdom'

export default function renderContainerBlock (block, cursor, activeBlocks, matches, useCache = false) {
  let selector = this.getSelector(block, cursor, activeBlocks)
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
    if (block.functionType === 'html') { // HTML Block
      Object.assign(data.dataset, { role: block.functionType.toUpperCase() })
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
  if (block.type === 'li' && block.label) {
    const { label } = block
    const { align } = activeBlocks[0]

    if (align && block.label === align) {
      selector += '.active'
    }
    Object.assign(data.dataset, { label })
  }
  if (block.type === 'li' && block.listItemType) {
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
    if (block.bulletListItemMarker) {
      Object.assign(data.dataset, { marker: block.bulletListItemMarker })
    }
    selector += block.isLooseListItem ? `.${CLASS_OR_ID['AG_LOOSE_LIST_ITEM']}` : `.${CLASS_OR_ID['AG_TIGHT_LIST_ITEM']}`
  }
  if (block.type === 'ol') {
    Object.assign(data.attrs, { start: block.start })
  }
  if (block.type === 'pre' && block.functionType === 'frontmatter') {
    Object.assign(data.dataset, { role: 'YAML' })
    selector += `.${CLASS_OR_ID['AG_FRONT_MATTER']}`
  }

  return h(selector, data, block.children.map(child => this.renderBlock(child, cursor, activeBlocks, matches, useCache)))
}
