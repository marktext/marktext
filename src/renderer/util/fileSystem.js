import path from 'path'
import fse from 'fs-extra'
import { ipcRenderer } from 'electron'
import { isImageFile } from '../../main/filesystem'
import { getUniqueId } from './index'

export const create = (pathname, type) => {
  if (type === 'directory') {
    return fse.ensureDir(pathname)
  } else {
    return fse.outputFile(pathname, '')
  }
}

export const paste = ({ src, dest, type }) => {
  return type === 'cut' ? fse.move(src, dest) : fse.copy(src, dest)
}

export const rename = (src, dest) => {
  return fse.move(src, dest)
}

/**
 * Check if the both paths point to the same file.
 *
 * @param {*} pathA The first path.
 * @param {*} pathB The second path.
 * @param {*} isNormalized Are both paths already normalized.
 */
export const isSameFileSync = (pathA, pathB, isNormalized=false) => {
  if (!pathA || !pathB) return false
  const a = isNormalized ? pathA : path.normalize(pathA)
  const b = isNormalized ? pathB : path.normalize(pathB)
  if (a.length !== b.length) {
    return false
  } else if (a === b) {
    return true
  } else if (a.toLowerCase() === b.toLowerCase()) {
    try {
      const fiA = fse.statSync(a)
      const fiB = fse.statSync(b)
      return fiA.ino === fiB.ino
    } catch (_) {
      // Ignore error
    }
  }
  return false
}

export const moveImageToFolder = async (pathname, image, dir) => {
  const isPath = typeof image === 'string'
  if (isPath) {
    const dirname = path.dirname(pathname)
    const imagePath = path.resolve(dirname, image)
    const isImage = isImageFile(imagePath)
    if (isImage) {
      const filename = path.basename(image)
      const distPath = path.join(dir, filename)
      if (distPath === imagePath) {
        return imagePath
      }
      await fse.copy(imagePath, distPath)
      return distPath
    } else {
      return Promise.resolve(image)
    }
  } else {
    const imagePath = path.join(dir, `${+new Date()}${image.name}`)

    const binaryString = await new Promise((resolve, reject) => {
      const fileReader = new FileReader()
      fileReader.onload = () => {
        resolve(fileReader.result)
      }

      fileReader.readAsBinaryString(image)
    })
    await fse.writeFile(imagePath, binaryString, 'binary')
    return imagePath
  }
}

export const uploadImageByPicGo = async (image) => {
  const id = getUniqueId()
  let re
  const promise = new Promise((resolve, reject) => {
    re = resolve
  })
  ipcRenderer.on(`mt::picgo-response-${id}`, (e, result) => {
    re(result)
  })
  
  if (typeof image === 'string') {
    ipcRenderer.send('mt::upload-image-by-picgo', { imageList: [ image ], id })
  } else {
    console.log(image)
    const reader = new FileReader()
    reader.onload = event => {
      const params = {
        base64Image: event.target.result,
        fileName: image.name,
        extname: `.${image.type.split('/')[1]}`
      }
      console.log(params)
      ipcRenderer.send('mt::upload-image-by-picgo', { imageList: [ params ], id })
    }
    reader.onerror = (err) => {
      re(null)
    }
    reader.readAsDataURL(image)
  }

  return promise
}
