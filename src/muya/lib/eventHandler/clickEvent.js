import { operateClassName } from '../utils/domManipulate'
import { CLASS_OR_ID } from '../config'
import selection from '../selection'

class ClickEvent {
  constructor (muya) {
    this.muya = muya
    this.clickBinding()
  }

  clickBinding () {
    const { container, eventCenter, contentState } = this.muya
    const handler = event => {
      const { target } = event
      // handler table | html toolbar click
      const toolItem = getToolItem(target)
      if (toolItem) {
        event.preventDefault()
        event.stopPropagation()
        const type = toolItem.getAttribute('data-label')
        const grandPa = toolItem.parentNode.parentNode
        if (grandPa.classList.contains('ag-tool-table')) {
          contentState.tableToolBarClick(type)
        } else if (grandPa.classList.contains('ag-tool-html')) {
          contentState.htmlToolBarClick(type)
        }
      }
      // handler image and inline math preview click
      const markedImageText = target.previousElementSibling
      const mathRender = target.closest(`.${CLASS_OR_ID['AG_MATH_RENDER']}`)
      const mathText = mathRender && mathRender.previousElementSibling
      if (markedImageText && markedImageText.classList.contains(CLASS_OR_ID['AG_IMAGE_MARKED_TEXT'])) {
        eventCenter.dispatch('format-click', {
          event,
          formatType: 'image',
          data: event.target.getAttribute('src')
        })
        selectionText(markedImageText)  
      } else if (mathText) {
        selectionText(mathText)
      }
      // handler html preview click
      const htmlPreview = target.closest(`.ag-function-html`)
      if (htmlPreview && !htmlPreview.classList.contains(CLASS_OR_ID['AG_ACTIVE'])) {
        event.preventDefault()
        event.stopPropagation()
        contentState.handleHtmlBlockClick(htmlPreview)
      }
      // handler container block preview click
      const container = target.closest('.ag-container-block')
      if (container && !container.classList.contains(CLASS_OR_ID['AG_ACTIVE'])) {
        event.preventDefault()
        event.stopPropagation()
        contentState.handleContainerBlockClick(container)
      }
      // handler to-do checkbox click
      if (target.tagName === 'INPUT' && target.classList.contains(CLASS_OR_ID['AG_TASK_LIST_ITEM_CHECKBOX'])) {
        contentState.listItemCheckBoxClick(target)
      }
      contentState.clickHandler(event)
    }

    eventCenter.attachDOMEvent(container, 'click', handler)
  }
}

function getToolItem (target) {
  return target.closest('[data-label]')
}

function selectionText (node) {
  const textLen = node.textContent.length
  operateClassName(node, 'remove', CLASS_OR_ID['AG_HIDE'])
  operateClassName(node, 'add', CLASS_OR_ID['AG_GRAY'])
  selection.importSelection({
    start: textLen,
    end: textLen
  }, node)
}

export default ClickEvent
