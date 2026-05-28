import { getUniqueId } from '../../../utils'
import { insertAfter, operateClassName } from '../../../utils/domManipulate'
import { CLASS_OR_ID } from '../../../config'

const addImageToContainer = (imageText, img, className) => {
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

export default function loadImageAsync(imageInfo, attrs, className, imageClass) {
  let { src } = imageInfo
  let id
  let isSuccess
  let w
  let h
  let domsrc

  src = src.replace(/ /g, '%20')
  // Necessary to ensure that marked actually parses these as images when exporting to HTML for printing (Else, it parses ![]() as text and does not render an image)

  let reload = false
  if (this.loadImageMap.has(src)) {
    const imageInfo = this.loadImageMap.get(src)
    if (imageInfo.dispMsec !== imageInfo.touchMsec) {
      // We have a cached image, but force it to load.
      reload = true
    }
    if (!imageInfo.isSuccess) {
      // There is a chance that it will succeed in loading this time, so we will try to reload it.
      reload = true
    }
  } else {
    reload = true
  }
  if (reload) {
    let addedToImageContainer = false
    id = getUniqueId()

    const img = document.createElement('img')
    let dispMsec = Date.now()
    let touchMsec = dispMsec
    if (/^file:\/\//.test(src)) {
      domsrc = src + '?msec=' + dispMsec
    } else {
      domsrc = src
    }
    img.src = domsrc
    if (attrs.alt) img.alt = attrs.alt.replace(/[`*{}[\]()#+\-.!_>~:|<>$]/g, '')
    if (attrs.title) img.setAttribute('title', attrs.title)
    if (attrs.width && typeof attrs.width === 'number') {
      img.setAttribute('width', attrs.width)
    }
    if (attrs.height && typeof attrs.height === 'number') {
      img.setAttribute('height', attrs.height)
    }
    if (imageClass) {
      img.classList.add(imageClass)
    }

    if (this.urlMap.has(src)) {
      this.urlMap.delete(src)
    }

    const imageText = document.querySelector(`#${id}`) // imageText refers to the image container
    if (imageText) {
      addImageToContainer(imageText, img, className)
      addedToImageContainer = true
    }

    img.onload = () => {
      const imageText = document.querySelector(`#${id}`) // imageText refers to the image container

      if (imageText && !addedToImageContainer) {
        addImageToContainer(imageText, img, className)
        addedToImageContainer = true
      }

      this.loadImageMap.set(src, {
        id,
        isSuccess: true,
        img,
        width: img.naturalWidth,
        height: img.naturalHeight,
        dispMsec,
        touchMsec,
        domsrc,
        addedToImageContainer
      })
    }
    img.onerror = () => {
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
        isSuccess: false,
        addedToImageContainer: false
      })
    }
  } else {
    const imageInfo = this.loadImageMap.get(src)

    id = imageInfo.id
    isSuccess = imageInfo.isSuccess
    w = imageInfo.width
    h = imageInfo.height
    domsrc = imageInfo.domsrc
    if (!imageInfo.addedToImageContaine && imageInfo.img) {
      const imageText = document.querySelector(`#${id}`)
      if (imageText) {
        addImageToContainer(imageText, imageInfo.img, className)
        this.loadImageMap.set(src, {
          ...imageInfo,
          addedToImageContainer: true
        })
      }
    }
  }

  return { id, isSuccess, domsrc, width: w, height: h }
}
