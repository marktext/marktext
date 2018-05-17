import virtualize from 'snabbdom-virtualize/strings'
const snabbdom = require('snabbdom')

export const patch = snabbdom.init([ // Init patch function with chosen modules
  require('snabbdom/modules/class').default, // makes it easy to toggle classes
  require('snabbdom/modules/attributes').default,
  require('snabbdom/modules/props').default, // for setting properties on DOM elements
  require('snabbdom/modules/dataset').default
])
export const h = require('snabbdom/h').default // helper function for creating vnodes
export const toHTML = require('snabbdom-to-html') // helper function for convert DOM to HTML string
export const toVNode = require('snabbdom/tovnode').default // helper function for convert DOM to vnode
export const htmlToVNode = virtualize // helper function for convert HTML string to vnode
