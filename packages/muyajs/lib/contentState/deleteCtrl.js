import selection from '../selection'

const deleteCtrl = (ContentState) => {
  // Handle `delete` keydown event on document.
  ContentState.prototype.docDeleteHandler = function(event) {
    // handle delete selected image
    const { selectedImage } = this
    if (selectedImage) {
      event.preventDefault()
      this.selectedImage = null
      return this.deleteImage(selectedImage)
    }
    if (this.selectedTableCells) {
      event.preventDefault()
      return this.deleteSelectedTableCells()
    }
  }

  ContentState.prototype.deleteHandler = function(event) {
    const { start, end } = selection.getCursorRange()
    if (!start || !end) {
      return
    }
    const startBlock = this.getBlock(start.key)
    const nextBlock = this.findNextBlockInLocation(startBlock)

    // TODO: @jocs It will delete all the editor and cause error in console when there is only one empty table. same as #67
    if (startBlock.type === 'figure') event.preventDefault()
    // If select multiple paragraph or multiple characters in one paragraph, just let
    // updateCtrl to handle this case.
    if (start.key !== end.key || start.offset !== end.offset) {
      return
    }
    // Only handle h1~h6 span block
    const { type, text, key } = startBlock
    if (/span/.test(type) && start.offset === 0 && text[1] === '\n') {
      event.preventDefault()
      startBlock.text = text.substring(2)
      this.cursor = {
        start: { key, offset: 0 },
        end: { key, offset: 0 },
        isEdit: true
      }
      return this.singleRender(startBlock)
    }
    if (/h\d|span/.test(type) && start.offset === text.length) {
      event.preventDefault()
      if (nextBlock && /h\d|span/.test(nextBlock.type)) {
        // if cursor at the end of code block-language input, do nothing!
        if (
          nextBlock.functionType === 'codeContent' &&
          startBlock.functionType === 'languageInput'
        ) {
          return
        }

        startBlock.text += nextBlock.text

        const toBeRemoved = [nextBlock]

        let parent = this.getParent(nextBlock)
        let target = nextBlock

        while (this.isOnlyRemoveableChild(target)) {
          toBeRemoved.push(parent)
          target = parent
          parent = this.getParent(parent)
        }

        toBeRemoved.forEach((b) => {
          // Check if the parent is a list
          const parent = this.getParent(b)

          // ============= LIST HANDLING=============
          if (parent && parent.type === 'li') {
            // We need to move any sublists to outside of the list item
            const ulBlock = this.getParent(parent)
            let insertAfterThis = ulBlock

            // Move any sublists out
            parent.children.forEach((child) => {
              if (/ul|ol/.test(child.type)) {
                this.insertAfter(child, insertAfterThis)
                insertAfterThis = child
              }
            })

            // Move any subsequent list items out
            let probe = this.getBlock(parent.nextSibling)
            const listItemToBeSaved = []
            while (probe && probe.type === 'li') {
              listItemToBeSaved.push(probe)
              probe = this.getBlock(probe.nextSibling)
            }
            if (listItemToBeSaved.length > 0) {
              const newULBlock = this.createBlock('ul')
              listItemToBeSaved.forEach((li) => {
                this.appendChild(newULBlock, li)
              })
              this.insertAfter(newULBlock, insertAfterThis)
            }

            // Then delete the parent ul block from the list
            this.removeBlock(ulBlock)
          } else {
            this.removeBlock(b)
          }
        })

        const offset = start.offset
        this.cursor = {
          start: { key, offset },
          end: { key, offset },
          isEdit: true
        }
        this.render()
      }
    }
  }
}

export default deleteCtrl
