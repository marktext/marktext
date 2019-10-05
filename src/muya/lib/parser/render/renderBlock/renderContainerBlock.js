import { CLASS_OR_ID } from '../../../config'
import { renderTableTools } from './renderToolBar'
import { renderEditIcon } from './renderContainerEditIcon'
import { renderLeftBar, renderBottomBar } from './renderTableDargBar'
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

export default function renderContainerBlock (parent, block, activeBlocks, matches, useCache = false) {
  let selector = this.getSelector(block, activeBlocks)
  const {
    key,
    align,
    type,
    headingStyle,
    editable,
    functionType,
    listType,
    listItemType,
    bulletMarkerOrDelimiter,
    isLooseListItem,
    lang,
    column
  } = block
  const children = block.children.map(child => this.renderBlock(block, child, activeBlocks, matches, useCache))
  const data = {
    attrs: {},
    dataset: {}
  }

  if (editable === false) {
    Object.assign(data.attrs, {
      contenteditable: 'false',
      spellcheck: 'false'
    })
  }

  if (/code|pre/.test(type) && typeof lang === 'string' && !!lang) {
    selector += `.language-${lang.replace(/[#.]{1}/g, '')}`
    Object.assign(data.attrs, { spellcheck: 'false' })
  }

  if (/th|td/.test(type)) {
    const { cells } = this.muya.contentState.selectedTableCells || {}
    if (cells && cells.length) {
      const cell = cells.find(c => c.key === key)
      if (cell) {
        const { top, right, bottom, left } = cell
        selector += '.ag-cell-selected'
        if (top) {
          selector += '.ag-cell-border-top'
        }
        if (right) {
          selector += '.ag-cell-border-right'
        }
        if (bottom) {
          selector += '.ag-cell-border-bottom'
        }
        if (left) {
          selector += '.ag-cell-border-left'
        }
      }
    }
  }

  // Judge whether to render the table drag bar.
  const { cells } = this.muya.contentState.selectedTableCells || {}
  if (/th|td/.test(type) && (!cells || cells && cells.length === 0)) {
    const table = this.muya.contentState.closest(block, 'table')
    const findTable = activeBlocks.find(b => b.key === table.key)
    if (findTable) {
      const { row: tableRow, column: tableColumn } = findTable
      const isLastRow = () => {
        const rowContainer = this.muya.contentState.closest(block, /tbody|thead/)
        if (rowContainer.type === 'thead') {
          return tableRow === 0
        } else {
          return !parent.nextSibling
        }
      }
      if (block.parent === activeBlocks[1].parent && !block.preSibling && tableRow > 0) {
        children.unshift(renderLeftBar())
      }

      if (column === activeBlocks[1].column && isLastRow() && tableColumn > 0) {
        children.push(renderBottomBar())
      }
    }
  }

  if (/th|td/.test(type)) {
    if (align) {
      Object.assign(data.attrs, {
        style: `text-align:${align}`
      })
    }
    if (typeof column === 'number') {
      Object.assign(data.dataset, {
        column
      })
    }
  } else if (/^h/.test(type)) {
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
      Object.assign(data.attrs, { spellcheck: 'false' })
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
    Object.assign(data.attrs, { spellcheck: 'false' })
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
