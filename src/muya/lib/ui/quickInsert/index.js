import { filter } from 'fuzzaldrin'
import { patch, h } from '../../parser/render/snabbdom'
import BaseFloat from '../baseFloat'
import { quicInsertList } from './config'
import './index.css'

class QuickInsert extends BaseFloat {
  constructor (muya) {
    super()
    this.container.classList.add('ag-quick-insert')
    this.muya = muya
    this.reference = null
    this.scrollElement = null
    this.oldVnode = null
    this.createScrollElement()
    this.render(quicInsertList)
    this.listen()
  }

  createScrollElement () {
    const { container } = this
    const scrollElement = document.createElement('div')
    container.appendChild(scrollElement)
    this.scrollElement = scrollElement
  }

  render (list) {
    const { scrollElement } = this
    let children = Object.keys(list).filter(key => {
      return list[key].length !== 0
    })
      .map(key => {
        const titleVnode = h('div.title', key.toUpperCase())
        const items = []
        for (const item of list[key]) {
          const { title, subTitle, label, icon } = item
          const iconVnode = h('div.icon-container', h('img', {
            attrs: {
              src: icon.url
            }
          })
            // h('svg', {
            //   attrs: {
            //     viewBox: icon.viewBox,
            //     'aria-hidden': 'true'
            //   },
            //   style: {
            //     fill: color
            //   },
            //   hook: {
            //     prepatch (oldvnode, vnode) {
            //       // cheat snabbdom that the pre block is changed!!!
            //       oldvnode.children = []
            //       oldvnode.elm.innerHTML = ''
            //     }
            //   }
            // }, h('use', {
            //   attrs: {
            //     'xlink:href': icon.url
            //   }
            // }))
          )

          const description = h('div.description', [
            h('div.big-title', title),
            h('div.sub-title', subTitle)
          ])
          items.push(h('div.item', { dataSet: { label } }, [iconVnode, description]))
        }

        return h('section', [titleVnode, ...items])
      })

    if (children.length === 0) {
      children = h('div.no-result', 'No result')
    }
    const vnode = h('div', children)

    if (this.oldVnode) {
      patch(this.oldVnode, vnode)
    } else {
      patch(scrollElement, vnode)
    }
    this.oldVnode = vnode
  }

  listen () {
    const { eventCenter } = this.muya
    eventCenter.subscribe('muya-quick-insert', (reference, text, status) => {
      if (status) {
        this.show(reference)
        this.search(text.substring(1)) // remove `@` char
      } else {
        this.hide()
      }
    })
  }

  hide () {
    super.hide()
    this.reference = null
  }

  show (reference) {
    if (this.reference && this.reference.id === reference.id && this.status) return
    this.reference = reference
    super.show(reference)
  }

  search (text) {
    let result = quicInsertList
    if (text !== '') {
      result = {}
      Object.keys(quicInsertList).forEach(key => {
        result[key] = filter(quicInsertList[key], text, { key: 'title' })
      })
    }

    this.render(result)
  }
}

export default QuickInsert
