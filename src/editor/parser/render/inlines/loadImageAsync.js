import { getUniqueId, loadImage } from '../../../utils'
import { insertAfter, operateClassName } from '../../../utils/domManipulate'
import { CLASS_OR_ID } from '../../../config'

export default function loadImageAsync (src, alt, className, imageClass) {
  let id
  let isSuccess

  if (!this.loadImageMap.has(src)) {
    id = getUniqueId()
    loadImage(src)
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
        this.loadImageMap.set(src, {
          id,
          isSuccess: true
        })
      })
      .catch(() => {
        const imageWrapper = document.querySelector(`#${id}`)
        if (imageWrapper) {
          operateClassName(imageWrapper, 'add', CLASS_OR_ID['AG_IMAGE_FAIL'])
        }
        this.loadImageMap.set(src, {
          id,
          isSuccess: false
        })
      })
  } else {
    const imageInfo = this.loadImageMap.get(src)
    id = imageInfo.id
    isSuccess = imageInfo.isSuccess
  }

  return { id, isSuccess }
}
