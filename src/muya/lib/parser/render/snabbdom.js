import { init } from 'snabbdom/build/package/init'
import { classModule } from 'snabbdom/build/package/modules/class'
import { attributesModule } from 'snabbdom/build/package/modules/attributes'
import { datasetModule } from 'snabbdom/build/package/modules/dataset'
import { propsModule } from 'snabbdom/build/package/modules/props'
import { styleModule } from 'snabbdom/build/package/modules/style'
import { eventListenersModule } from 'snabbdom/build/package/modules/eventlisteners'

import { h as sh } from 'snabbdom/build/package/h'
import { toVNode as sToVNode } from 'snabbdom/build/package/tovnode'

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
