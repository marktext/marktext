import { getUniqueId, loadImage } from '../../../utils'
import { insertAfter, operateClassName } from '../../../utils/domManipulate'
import { CLASS_OR_ID } from '../../../config'

export default function loadImageAsync (imageInfo, alt, className, imageClass) {
  const { src, isUnknownType } = imageInfo
  let id
  let isSuccess

  if (!this.loadImageMap.has(src)) {
    id = getUniqueId()
    loadImage(src, isUnknownType)
      .then(url => {
        const imageText = document.querySelector(`#${id}`)
        const img = document.createElement('img')
        img.src = url
        if (alt) img.alt = alt.replace(/[`*{}[\]()#+\-.!_>~:|<>$]/g, '')
        if (imageClass) {
          img.classList.add(imageClass)
        }

        if (imageText) {
          if (imageText.classList.contains('ag-inline-image')) {
            const imageContainer = imageText.querySelector('.ag-image-container')
            const oldImage = imageContainer.querySelector('img')
            if (oldImage) {
              oldImage.remove()
            }
            imageContainer.appendChild(img)
            imageText.classList.remove('ag-image-loading')
            imageText.classList.add('ag-image-success')
          } else {
            insertAfter(img, imageText)
            operateClassName(imageText, 'add', className)
          }
        }
        if (this.urlMap.has(src)) {
          this.urlMap.delete(src)
        }
        this.loadImageMap.set(src, {
          id,
          isSuccess: true
        })
      })
      .catch(() => {
        const imageText = document.querySelector(`#${id}`)
        if (imageText) {
          operateClassName(imageText, 'remove', CLASS_OR_ID.AG_IMAGE_LOADING)
          operateClassName(imageText, 'add', CLASS_OR_ID.AG_IMAGE_FAIL)
          const image = imageText.querySelector('img')
          if (image) {
            image.remove()
          }
        }
        if (this.urlMap.has(src)) {
          this.urlMap.delete(src)
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
