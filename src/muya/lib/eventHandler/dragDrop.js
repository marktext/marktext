class DragDrop {
  constructor (muya) {
    this.muya = muya
    this.dragOverBinding()
    this.dropBinding()
    this.dragendBinding()
  }

  dragOverBinding () {
    const { container, eventCenter, contentState } = this.muya

    const dragoverHandler = event => {
      contentState.dragoverHandler(event)
    }

    eventCenter.attachDOMEvent(container, 'dragover', dragoverHandler)
  }

  dropBinding () {
    const { container, eventCenter, contentState } = this.muya

    const dropHandler = event => {
      contentState.dropHandler(event)
    }

    eventCenter.attachDOMEvent(container, 'drop', dropHandler)
  }

  dragendBinding () {
    const { eventCenter, contentState } = this.muya

    const dragleaveHandler = event => {
      contentState.dragleaveHandler(event)
    }

    eventCenter.attachDOMEvent(window, 'dragleave', dragleaveHandler)
  }
}

export default DragDrop
