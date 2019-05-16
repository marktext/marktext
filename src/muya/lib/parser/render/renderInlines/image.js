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
  const { selectedImage } = this.muya.contentState
  const data = {
    dataset: {
      raw: token.raw
    },
    attrs: {
      contenteditable: 'true'
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

  const imageIcons = [
    renderIcon(h, 'ag-image-icon-success', ImageIcon),
    renderIcon(h, 'ag-image-icon-fail', ImageFailIcon)
  ]
  const toolIcons = [
    renderIcon(h, 'ag-image-icon-turninto', TurnIntoIcon),
    renderIcon(h, 'ag-image-icon-delete', DeleteIcon)
  ]
  const renderImageContainer = (...args) => {
    return h(`span.${CLASS_OR_ID['AG_IMAGE_CONTAINER']}`, {
      attrs: {
        contenteditable: 'false'
      }
    }, args)
  }
  if (src) {
    // image is loading...
    if (typeof isSuccess === 'undefined') {
      wrapperSelector += `.${CLASS_OR_ID['AG_IMAGE_LOADING']}`
    } else if (isSuccess === true) {
      wrapperSelector += `.${CLASS_OR_ID['AG_IMAGE_SUCCESS']}`
    } else {
      wrapperSelector += `.${CLASS_OR_ID['AG_IMAGE_FAIL']}`
    }

    if (selectedImage) {
      const { key, token: selectToken } = selectedImage
      if (
        key === block.key &&
        selectToken.range.start === token.range.start &&
        selectToken.range.end === token.range.end
      ) {
        wrapperSelector += `.${CLASS_OR_ID['AG_INLINE_IMAGE_SELECTED']}`
      }
    }

    return isSuccess
      ? [
        h(wrapperSelector, data, [
          ...imageIcons,
          renderImageContainer(
            ...toolIcons,
            h('img', { props: { alt, src, title } })
          )
        ])
      ]
      : [
        h(wrapperSelector, data, [
          ...imageIcons,
          renderImageContainer(
            ...toolIcons
          )
        ])
      ]
  } else {
    wrapperSelector += `.${CLASS_OR_ID['AG_EMPTY_IMAGE']}`
    return [
      h(wrapperSelector, data, [
        ...imageIcons,
        renderImageContainer(
          ...toolIcons
        )
      ])
    ]
  }
}
