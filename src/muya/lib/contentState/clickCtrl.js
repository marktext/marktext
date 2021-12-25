import selection from '../selection'
import { isMuyaEditorElement } from '../selection/dom'
import { HAS_TEXT_BLOCK_REG, CLASS_OR_ID } from '../config'
import { getParentCheckBox } from '../utils/getParentCheckBox'
import { cumputeCheckboxStatus } from '../utils/cumputeCheckBoxStatus'

const clickCtrl = ContentState => {
  ContentState.prototype.clickHandler = function (event) {
    const { eventCenter } = this.muya
    const { target } = event
    if (isMuyaEditorElement(target)) {
      const lastBlock = this.getLastBlock()
      const archor = this.findOutMostBlock(lastBlock)
      const archorParagraph = document.querySelector(`#${archor.key}`)
      if (archorParagraph === null) {
        return
      }
      const rect = archorParagraph.getBoundingClientRect()
      // If click below the last paragraph
      // and the last paragraph is not empty, create a new empty paragraph
      if (event.clientY > rect.top + rect.height) {
        let needToInsertNewParagraph = false
        if (lastBlock.type === 'span') {
          if (/atxLine|paragraphContent/.test(lastBlock.functionType) && /\S/.test(lastBlock.text)) {
            needToInsertNewParagraph = true
          }
          if (!/atxLine|paragraphContent/.test(lastBlock.functionType)) {
            needToInsertNewParagraph = true
          }
        } else {
          needToInsertNewParagraph = true
        }

        if (needToInsertNewParagraph) {
          event.preventDefault()
          const paragraphBlock = this.createBlockP()
          this.insertAfter(paragraphBlock, archor)
          const key = paragraphBlock.children[0].key
          const offset = 0
          this.cursor = {
            start: { key, offset },
            end: { key, offset }
          }

          return this.render()
        }
      }
    }
    // handle front menu click
    const { start: oldStart, end: oldEnd } = this.cursor
    if (oldStart && oldEnd) {
      let hasSameParent = false
      const startBlock = this.getBlock(oldStart.key)
      const endBlock = this.getBlock(oldEnd.key)
      if (startBlock && endBlock) {
        const startOutBlock = this.findOutMostBlock(startBlock)
        const endOutBlock = this.findOutMostBlock(endBlock)
        hasSameParent = startOutBlock === endOutBlock
      }
      // show the muya-front-menu only when the cursor in the same paragraph
      if (target.closest('.ag-front-icon') && hasSameParent) {
        const currentBlock = this.findOutMostBlock(startBlock)
        const frontIcon = target.closest('.ag-front-icon')
        const rect = frontIcon.getBoundingClientRect()
        const reference = {
          getBoundingClientRect () {
            return rect
          },
          clientWidth: rect.width,
          clientHeight: rect.height,
          id: currentBlock.key
        }
        this.selectedBlock = currentBlock
        eventCenter.dispatch('muya-front-menu', { reference, outmostBlock: currentBlock, startBlock, endBlock })
        return this.partialRender()
      }
    }
    const { start, end } = selection.getCursorRange()
    // fix #625, the selection maybe not in edit area.
    if (!start || !end) {
      return
    }
    // format-click
    const node = selection.getSelectionStart()
    const inlineNode = node ? node.closest('.ag-inline-rule') : null

    // link-format-click
    let parentNode = inlineNode
    while (parentNode !== null && parentNode.classList.contains(CLASS_OR_ID.AG_INLINE_RULE)) {
      if (parentNode.tagName === 'A') {
        const formatType = 'link' // auto link or []() link
        const data = {
          text: inlineNode.textContent,
          href: parentNode.getAttribute('href') || ''
        }
        eventCenter.dispatch('format-click', {
          event,
          formatType,
          data
        })
        break
      } else {
        parentNode = parentNode.parentNode
      }
    }

    if (inlineNode) {
      let formatType = null
      let data = null
      switch (inlineNode.tagName) {
        case 'SPAN': {
          if (inlineNode.hasAttribute('data-emoji')) {
            formatType = 'emoji'
            data = inlineNode.getAttribute('data-emoji')
          } else if (inlineNode.classList.contains('ag-math-text')) {
            formatType = 'inline_math'
            data = inlineNode.textContent
          }
          break
        }
        case 'STRONG': {
          formatType = 'strong'
          data = inlineNode.textContent
          break
        }
        case 'EM': {
          formatType = 'em'
          data = inlineNode.textContent
          break
        }
        case 'DEL': {
          formatType = 'del'
          data = inlineNode.textContent
          break
        }
        case 'CODE': {
          formatType = 'inline_code'
          data = inlineNode.textContent
          break
        }
      }
      if (formatType) {
        eventCenter.dispatch('format-click', {
          event,
          formatType,
          data
        })
      }
    }
    const block = this.getBlock(start.key)
    let needRender = false
    // is show format float box?
    if (
      start.key === end.key &&
      start.offset !== end.offset &&
      HAS_TEXT_BLOCK_REG.test(block.type) &&
      block.functionType !== 'codeContent' &&
      block.functionType !== 'languageInput'
    ) {
      const reference = this.getPositionReference()
      const { formats } = this.selectionFormats()
      eventCenter.dispatch('muya-format-picker', { reference, formats })
    }

    // update '```xxx' to code block when you click other place or use press arrow key.
    if (block && start.key !== this.cursor.start.key) {
      const oldBlock = this.getBlock(this.cursor.start.key)
      if (oldBlock) {
        needRender = needRender || this.codeBlockUpdate(oldBlock)
      }
    }

    // change active status when paragraph changed
    if (
      start.key !== this.cursor.start.key ||
      end.key !== this.cursor.end.key
    ) {
      needRender = true
    }

    const needMarkedUpdate = this.checkNeedRender(this.cursor) || this.checkNeedRender({ start, end })

    if (needRender) {
      this.cursor = { start, end }
      return this.partialRender()
    } else if (needMarkedUpdate) {
      // Fix: whole select can not be canceled #613
      requestAnimationFrame(() => {
        const cursor = selection.getCursorRange()
        if (!cursor.start || !cursor.end) {
          return
        }
        this.cursor = cursor

        return this.partialRender()
      })
    } else {
      this.cursor = { start, end }
    }
  }

  ContentState.prototype.setCheckBoxState = function (checkbox, checked) {
    checkbox.checked = checked
    const block = this.getBlock(checkbox.id)
    block.checked = checked
    checkbox.classList.toggle(CLASS_OR_ID.AG_CHECKBOX_CHECKED)
  }

  ContentState.prototype.updateParentsCheckBoxState = function (checkbox) {
    let parent = getParentCheckBox(checkbox)
    while (parent !== null) {
      const checked = cumputeCheckboxStatus(parent)
      if (parent.checked !== checked) {
        this.setCheckBoxState(parent, checked)
        parent = getParentCheckBox(parent)
      } else {
        break
      }
    }
  }

  ContentState.prototype.updateChildrenCheckBoxState = function (checkbox, checked) {
    const checkboxes = checkbox.parentElement.querySelectorAll(`input ~ ul .${CLASS_OR_ID.AG_TASK_LIST_ITEM_CHECKBOX}`)
    const len = checkboxes.length
    for (let i = 0; i < len; i++) {
      const checkbox = checkboxes[i]
      if (checkbox.checked !== checked) {
        this.setCheckBoxState(checkbox, checked)
      }
    }
  }

  // handle task list item checkbox click
  ContentState.prototype.listItemCheckBoxClick = function (checkbox) {
    const { checked } = checkbox
    this.setCheckBoxState(checkbox, checked)

    // A task checked, then related task should be update
    const { autoCheck } = this.muya.options
    if (autoCheck) {
      this.updateChildrenCheckBoxState(checkbox, checked)
      this.updateParentsCheckBoxState(checkbox)
    }

    const block = this.getBlock(checkbox.id)
    const parentBlock = this.getParent(block)
    const firstEditableBlock = this.firstInDescendant(parentBlock)
    const { key } = firstEditableBlock
    const offset = 0
    this.cursor = { start: { key, offset }, end: { key, offset } }
    return this.partialRender()
  }
}

export default clickCtrl
