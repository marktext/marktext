import {
  init,
  classModule,
  attributesModule,
  datasetModule,
  propsModule,
  styleModule,
  eventListenersModule,
  h as sh,
  toVNode as sToVNode
} from 'snabbdom'

export const patch = init([
  classModule,
  attributesModule,
  styleModule,
  propsModule,
  datasetModule,
  eventListenersModule
])

export const h = sh
export const toVNode = sToVNode

export const toHTML = require('snabbdom-to-html') // helper function for convert vnode to HTML string
export const htmlToVNode = html => { // helper function for convert html to vnode
  const wrapper = document.createElement('div')
  wrapper.innerHTML = html

  return toVNode(wrapper).children
}

const addNS = ({ data, children, sel }) => {
  data.ns = 'http://www.w3.org/2000/svg'
  if (sel !== 'foreignObject' && children !== undefined) {
    for (const vNode of children) {
      if (vNode.data === undefined) continue
      addNS(vNode)
    }
  }
}

export const addNStoVNodeSvgChildren = (children = []) => {
  for (const vNode of children) {
    if (vNode.data === undefined) continue
    if (vNode.sel.startsWith('svg')) addNS(vNode)
    addNStoVNodeSvgChildren(vNode.children)
  }
}
