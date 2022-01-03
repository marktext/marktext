import { CLASS_OR_ID } from '../../../config'
import { renderTableTools } from './renderToolBar'
import { footnoteJumpIcon } from './renderFootnoteJump'
import { renderEditIcon } from './renderContainerEditIcon'
// import renderLineNumberRows from './renderLineNumber'
import renderCopyButton from './renderCopyButton'
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
  plantuml: `.${CLASS_OR_ID.AG_PLANTUML}`,
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

  if (type === 'table') {
    this.renderingTable = block
  } else if (/thead|tbody/.test(type)) {
    this.renderingRowContainer = block
  }

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

  if (/code|pre/.test(type)) {
    if (typeof lang === 'string' && !!lang) {
      selector += `.language-${lang.replace(/[#.]{1}/g, '')}`
    }
    if (type === 'pre') {
      children.unshift(renderCopyButton())
    }
    // FIXME: Disabled due to #1648 - be consistent.
    // if (this.muya.options.codeBlockLineNumbers) {
    //   if (type === 'pre') {
    //     selector += '.line-numbers'
    //   } else {
    //     children.unshift(renderLineNumberRows(block.children[0]))
    //   }
    // }
    Object.assign(data.attrs, { spellcheck: 'false' })
  }

  if (/^(?:th|td)$/.test(type)) {
    const { cells } = this.muya.contentState.selectedTableCells || {}
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
    } else {
      // Judge whether to render the table drag bar.
      const { renderingTable, renderingRowContainer } = this

      const findTable = renderingTable ? activeBlocks.find(b => b.key === renderingTable.key) : null
      if (findTable && renderingRowContainer) {
        const { row: tableRow, column: tableColumn } = findTable
        const isLastRow = () => {
          if (renderingRowContainer.type === 'thead') {
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
      if (functionType === 'table' && activeBlocks[0] && activeBlocks[0].functionType === 'cellContent') {
        children.unshift(renderTableTools(activeBlocks))
      } else if (functionType !== 'footnote') {
        children.unshift(renderEditIcon())
      } else {
        children.push(footnoteJumpIcon())
      }
    }

    if (
      /html|multiplemath|flowchart|mermaid|sequence|plantuml|vega-lite/.test(functionType)
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

    if (/html|multiplemath|mermaid|flowchart|vega-lite|sequence|plantuml/.test(functionType)) {
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
