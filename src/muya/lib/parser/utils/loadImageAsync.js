import { getUniqueId, loadImage } from '../../utils'
import { insertAfter, operateClassName } from '../../utils/domManipulate'
import { CLASS_OR_ID } from '../../config'

export default function loadImageAsync (imageInfo, alt, className, imageClass, stateRender) {
  const { src, isUnknownType } = imageInfo
  let id
  let isSuccess
  let { loadImageMap } = stateRender
  if (!loadImageMap.has(src)) {
    id = getUniqueId()
    loadImage(src, isUnknownType)
      .then(url => {
        const imageWrapper = document.querySelector(`#${id}`)
        const img = document.createElement('img')
        img.src = url
        if (alt) img.alt = alt
        if (imageClass) {
          img.classList.add(imageClass)
        }
        if (imageWrapper) {
          insertAfter(img, imageWrapper)
          operateClassName(imageWrapper, 'add', className)
        }
        loadImageMap.set(src, {
          id,
          isSuccess: true
        })
      })
      .catch(() => {
        const imageWrapper = document.querySelector(`#${id}`)
        if (imageWrapper) {
          operateClassName(imageWrapper, 'add', CLASS_OR_ID['AG_IMAGE_FAIL'])
        }
        loadImageMap.set(src, {
          id,
          isSuccess: false
        })
      })
  } else {
    const imageInfo = loadImageMap.get(src)
    id = imageInfo.id
    isSuccess = imageInfo.isSuccess
  }

  return { id, isSuccess }
}
