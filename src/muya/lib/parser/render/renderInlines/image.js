import { CLASS_OR_ID } from '../../../config'
import { getImageInfo } from '../../../utils'
import ImageIcon from '../../../assets/pngicon/image/2.png'
import ImageFailIcon from '../../../assets/pngicon/image_fail/2.png'
import TurnIntoIcon from '../../../assets/pngicon/turninto/2.png'
import DeleteIcon from '../../../assets/pngicon/delete/delete@2x.png'

const renderIcon = (h, className, icon) => {
  const selector = `a.${className}`
  const iconVnode = h('i.icon', h(`i.icon-inner`, {
    style: {
      background: `url(${icon}) no-repeat`,
      'background-size': '100%'
    }
  }, ''))

  return h(selector, {
    attrs: {
      contenteditable: 'false'
    }
  }, iconVnode)
}

// I dont want operate dom directly, is there any better method? need help!
export default function image (h, cursor, block, token, outerClass) {
  const imageInfo = getImageInfo(token.src + encodeURI(token.backlash.second))
  const data = {
    attrs: {
      contenteditable: 'false'
    }
  }
  let id
  let isSuccess
  const { src } = imageInfo
  const alt = token.alt + encodeURI(token.backlash.first)
  const { title } = token
  if (src) {
    ({ id, isSuccess } = this.loadImageAsync(imageInfo, alt))
  }
  let wrapperSelector = id
    ? `span#${id}.${CLASS_OR_ID['AG_INLINE_IMAGE']}`
    : `span.${CLASS_OR_ID['AG_INLINE_IMAGE']}`
  
  const content = h(`span.${CLASS_OR_ID['AG_HIDE']}.${CLASS_OR_ID['AG_REMOVE']}`, token.raw)
  const icons = [
    renderIcon(h, 'ag-image-icon-turninto', TurnIntoIcon),
    renderIcon(h, 'ag-image-icon-delete', DeleteIcon),
    renderIcon(h, 'ag-image-icon-success', ImageIcon),
    renderIcon(h, 'ag-image-icon-fail', ImageFailIcon)
  ]
  if (src) {
    // image is loading...
    if (typeof isSuccess === 'undefined') {
      wrapperSelector += `.${CLASS_OR_ID['AG_IMAGE_LOADING']}`
    } else if (isSuccess === true) {
      wrapperSelector += `.${CLASS_OR_ID['AG_IMAGE_SUCCESS']}`
    } else {
      wrapperSelector += `.${CLASS_OR_ID['AG_IMAGE_FAIL']}`
    }

    return isSuccess
      ? [
        h(wrapperSelector, data, [
          content,
          ...icons,
          h('img', { props: { alt, src, title } })
        ])
      ]
      : [
        h(wrapperSelector, data, [
          content,
          renderIcon(h, 'ag-image-icon-success', ImageIcon),
          renderIcon(h, 'ag-image-icon-fail', ImageFailIcon)
        ])
      ]
  } else {
    wrapperSelector += `.${CLASS_OR_ID['AG_EMPTY_IMAGE']}`
    return [
      h(wrapperSelector, data, [
        content,
        ...icons
      ])
    ]
  }
}
