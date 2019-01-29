// import virtualize from 'snabbdom-virtualize/strings'
const snabbdom = require('snabbdom')

export const patch = snabbdom.init([ // Init patch function with chosen modules
  require('snabbdom/modules/class').default, // makes it easy to toggle classes
  require('snabbdom/modules/attributes').default,
  require('snabbdom/modules/style').default, // handles styling on elements with support for animations
  require('snabbdom/modules/props').default, // for setting properties on DOM elements
  require('snabbdom/modules/dataset').default,
  require('snabbdom/modules/eventlisteners').default // attaches event listeners
])
export const h = require('snabbdom/h').default // helper function for creating vnodes
export const toHTML = require('snabbdom-to-html') // helper function for convert vnode to HTML string
export const toVNode = require('snabbdom/tovnode').default // helper function for convert DOM to vnode
export const htmlToVNode = html => { // helper function for convert html to vnode
  const wrapper = document.createElement('div')
  wrapper.innerHTML = html
  return toVNode(wrapper).children
}
