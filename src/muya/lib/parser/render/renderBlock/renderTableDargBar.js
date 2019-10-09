import { h } from '../snabbdom'

export const renderLeftBar = () => {
  return h('span.ag-drag-handler.left', {
    attrs: { contenteditable: 'false' }
  })
}

export const renderBottomBar = () => {
  return h('span.ag-drag-handler.bottom', {
    attrs: { contenteditable: 'false' }
  })
}
