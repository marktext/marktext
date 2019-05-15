import { CLASS_OR_ID } from '../../../config'
import { getImageInfo } from '../../../utils'
import ImageIcon from '../../../assets/pngicon/image/2.png'
import ImageFailIcon from '../../../assets/pngicon/image_fail/2.png'

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
    ? `span#image-wrapper-${id}.${CLASS_OR_ID['AG_INLINE_IMAGE']}`
    : `span.${CLASS_OR_ID['AG_INLINE_IMAGE']}`
  
  if (src) {
    // to
    console.log(isSuccess)
    console.log(title)
  } else {
    wrapperSelector += `.${CLASS_OR_ID['AG_EMPTY_IMAGE']}`
    return [
      h(wrapperSelector, data, [
        renderIcon(h, 'ag-image-icon-success', ImageIcon),
        renderIcon(h, 'ag-image-icon-fail', ImageFailIcon)
      ])
    ]
  }
}
