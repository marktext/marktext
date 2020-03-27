import { h } from '../snabbdom'
import { CLASS_OR_ID } from '../../../config'
import htmlIcon from '../../../assets/pngicon/html/2.png'

export const renderEditIcon = () => {
  const selector = `a.${CLASS_OR_ID.AG_CONTAINER_ICON}`
  const iconVnode = h('i.icon', h('i.icon-inner', {
    style: {
      background: `url(${htmlIcon}) no-repeat`,
      'background-size': '100%'
    }
  }, ''))

  return h(selector, {
    attrs: {
      contenteditable: 'false'
    }
  }, iconVnode)
}
