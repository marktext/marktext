import selection from '../selection'

const getCurrentLevel = type => {
  if (/\d/.test(type)) {
    return Number(/\d/.exec(type)[0])
  } else {
    return 0
  }
}

const paragraphCtrl = ContentState => {
  ContentState.prototype.selectionChange = function () {
    const {
      start,
      end
    } = selection.getCursorRange()
    start.type = this.getBlock(start.key).type
    end.type = this.getBlock(end.key).type
    return {
      start,
      end
    }
  }

  ContentState.prototype.updateParagraph = function (paraType) {
    const {
      start, end
    } = selection.getCursorRange()
    const block = this.getBlock(start.key)
    const {
      type, text
    } = block

    switch (paraType) {
      case 'heading 1':
      case 'heading 2':
      case 'heading 3':
      case 'heading 4':
      case 'heading 5':
      case 'heading 6':
      case 'upgrade heading':
      case 'degrade heading':
      case 'paragraph': {
        const [, hash, partText] = /(^#*)(.*)/.exec(text)
        let newLevel = 0
        let newType = 'p'
        if (/\d/.test(paraType)) {
          newLevel = Number(paraType.split(/\s/)[1])
          newType = `h${newLevel}`
        } else if (paraType === 'upgrade heading' || paraType === 'degrade heading') {
          const currentLevel = getCurrentLevel(type)
          newLevel = currentLevel
          if (paraType === 'upgrade heading' && currentLevel !== 1) {
            if (currentLevel === 0) newLevel = 6
            else newLevel = currentLevel - 1
          } else if (paraType === 'degrade heading' && currentLevel !== 0) {
            if (currentLevel === 6) newLevel = 0
            else newLevel = currentLevel + 1
          }
          newType = newLevel === 0 ? 'p' : `h${newLevel}`
        }

        start.offset += newLevel - hash.length
        end.offset += newLevel - hash.length
        block.text = '#'.repeat(newLevel) + partText
        block.type = newType
        this.cursor = { start, end }
        break
      }
      case 'hr': {
        const newBlock = this.createBlock('p')
        let hrBlock
        if (text) {
          hrBlock = this.createBlock('hr')
          hrBlock.text = '---'
          this.insertAfter(hrBlock, block)
          this.insertAfter(newBlock, hrBlock)
        } else {
          block.type = 'hr'
          block.text = '---'
          this.insertAfter(newBlock, block)
        }
        const key = newBlock.key
        const offset = 0
        this.cursor = {
          start: { key, offset },
          end: { key, offset }
        }
        break
      }
    }
    this.render()
  }
}

export default paragraphCtrl
