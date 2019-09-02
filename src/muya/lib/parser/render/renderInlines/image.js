import { CLASS_OR_ID } from '../../../config'
import { getImageInfo } from '../../../utils'
import ImageIcon from '../../../assets/pngicon/image/2.png'
import ImageFailIcon from '../../../assets/pngicon/image_fail/2.png'
import ImageEditIcon from '../../../assets/pngicon/imageEdit/2.png'
import DeleteIcon from '../../../assets/pngicon/delete/delete@2x.png'

const renderIcon = (h, className, icon) => {
  const selector = `a.${className}`
  const iconVnode = h('i.icon', h('i.icon-inner', {
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
    }
  }
  let id
  let isSuccess
  let width
  let height
  let { src } = imageInfo
  const alt = token.alt + encodeURI(token.backlash.first)
  const { title } = token
  if (src) {
    ({ id, isSuccess, width, height } = this.loadImageAsync(imageInfo, alt))
  }
  let wrapperSelector = id
    ? `span#${id}.${CLASS_OR_ID.AG_INLINE_IMAGE}`
    : `span.${CLASS_OR_ID.AG_INLINE_IMAGE}`

  const imageIcons = [
    renderIcon(h, 'ag-image-icon-success', ImageIcon),
    renderIcon(h, 'ag-image-icon-fail', ImageFailIcon),
    renderIcon(h, 'ag-image-icon-close', DeleteIcon)
  ]
  const toolIcons = [
    h(`span.${CLASS_OR_ID.AG_IMAGE_BUTTONS}`, {
      attrs: {
        contenteditable: 'false'
      }
    }, [
      renderIcon(h, 'ag-image-icon-turninto', ImageEditIcon),
      renderIcon(h, 'ag-image-icon-delete', DeleteIcon)
    ])
  ]
  const renderImageContainer = (...args) => {
    return h(`span.${CLASS_OR_ID.AG_IMAGE_CONTAINER}`, {}, args)
  }

  // the src image is still loading, so use the url Map base64.
  if (this.urlMap.has(src)) {
    // fix: it will generate a new id if the image is not loaded.
    const { selectedImage } = this.muya.contentState
    if (selectedImage && selectedImage.token.src === src && selectedImage.imageId !== id) {
      selectedImage.imageId = id
    }
    src = this.urlMap.get(src)
    isSuccess = true
  }

  if (alt.startsWith('loading-')) {
    wrapperSelector += `.${CLASS_OR_ID.AG_IMAGE_UPLOADING}`
    Object.assign(data.dataset, {
      id: alt
    })
    if (this.urlMap.has(alt)) {
      src = this.urlMap.get(alt)
      isSuccess = true
    }
  }
  if (src) {
    // image is loading...
    if (typeof isSuccess === 'undefined') {
      wrapperSelector += `.${CLASS_OR_ID.AG_IMAGE_LOADING}`
    } else if (isSuccess === true) {
      wrapperSelector += `.${CLASS_OR_ID.AG_IMAGE_SUCCESS}`
      if (typeof width === 'number' && typeof height === 'number' && (width < 100 || height < 100)) {
        wrapperSelector += '.ag-small-image'
      }
    } else {
      wrapperSelector += `.${CLASS_OR_ID.AG_IMAGE_FAIL}`
    }

    if (selectedImage) {
      const { key, token: selectToken } = selectedImage
      if (
        key === block.key &&
        selectToken.range.start === token.range.start &&
        selectToken.range.end === token.range.end
      ) {
        wrapperSelector += `.${CLASS_OR_ID.AG_INLINE_IMAGE_SELECTED}`
      }
    }

    return isSuccess
      ? [
        h(wrapperSelector, data, [
          ...imageIcons,
          renderImageContainer(
            ...toolIcons,
            // An image description has inline elements as its contents.
            // When an image is rendered to HTML, this is standardly used as the image’s alt attribute.
            h('img', { props: { alt: alt.replace(/[`*{}[\]()#+\-.!_>~:|<>$]/g, ''), src, title } })
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
    wrapperSelector += `.${CLASS_OR_ID.AG_EMPTY_IMAGE}`
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
