import path from 'path'
import crypto from 'crypto'
import { clipboard } from 'electron'
import fs from 'fs-extra'
import dayjs from 'dayjs'
import { Octokit } from '@octokit/rest'
import { ensureDirSync } from 'common/filesystem'
import { isImageFile } from 'common/filesystem/paths'
import { dataURItoBlob } from './index'
import axios from '../axios'

export const create = (pathname, type) => {
  if (type === 'directory') {
    return fs.ensureDir(pathname)
  } else {
    return fs.outputFile(pathname, '')
  }
}

export const paste = ({ src, dest, type }) => {
  return type === 'cut' ? fs.move(src, dest) : fs.copy(src, dest)
}

export const rename = (src, dest) => {
  return fs.move(src, dest)
}

export const getHash = (content, encoding, type) => {
  return crypto.createHash(type).update(content, encoding).digest('hex')
}

export const getContentHash = content => {
  return getHash(content, 'utf8', 'sha1')
}

export const moveToRelativeFolder = async (cwd, imagePath, relativeName) => {
  if (!relativeName) {
    // Use fallback name according settings description
    relativeName = 'assets'
  } else if (path.isAbsolute(relativeName)) {
    throw new Error('Invalid relative directory name')
  }

  // Path combination:
  //  - markdown file directory + relative directory name or
  //  - root directory + relative directory name
  const absPath = path.resolve(cwd, relativeName)
  const dstPath = path.resolve(absPath, path.basename(imagePath))
  ensureDirSync(absPath)
  await fs.move(imagePath, dstPath, { overwrite: true })

  // dstRelPath: relative directory name + image file name
  const dstRelPath = path.join(relativeName, path.basename(imagePath))
  return dstRelPath
}

export const moveImageToFolder = async (pathname, image, dir) => {
  ensureDirSync(dir)
  const isPath = typeof image === 'string'
  if (isPath) {
    const dirname = path.dirname(pathname)
    const imagePath = path.resolve(dirname, image)
    const isImage = isImageFile(imagePath)
    if (isImage) {
      const filename = path.basename(imagePath)
      const extname = path.extname(imagePath)
      const noHashPath = path.join(dir, filename)
      if (noHashPath === imagePath) {
        return imagePath
      }
      const hash = getContentHash(imagePath)
      // To avoid name conflict.
      const hashFilePath = path.join(dir, `${hash}${extname}`)
      await fs.copy(imagePath, hashFilePath)
      return hashFilePath
    } else {
      return Promise.resolve(image)
    }
  } else {
    const imagePath = path.join(dir, `${dayjs().format('YYYY-MM-DD-HH-mm-ss')}-${image.name}`)

    const binaryString = await new Promise((resolve, reject) => {
      const fileReader = new FileReader()
      fileReader.onload = () => {
        resolve(fileReader.result)
      }

      fileReader.readAsBinaryString(image)
    })
    await fs.writeFile(imagePath, binaryString, 'binary')
    return imagePath
  }
}

/**
 * @jocs todo, rewrite it use class
 */
export const uploadImage = async (pathname, image, preferences) => {
  const { currentUploader } = preferences
  const { owner, repo, branch } = preferences.imageBed.github
  const token = preferences.githubToken
  const isPath = typeof image === 'string'
  const MAX_SIZE = 5 * 1024 * 1024
  let re
  let rj
  const promise = new Promise((resolve, reject) => {
    re = resolve
    rj = reject
  })

  const uploadToSMMS = file => {
    const api = 'https://sm.ms/api/upload'
    const formData = new window.FormData()
    formData.append('smfile', file)
    axios({
      method: 'post',
      url: api,
      data: formData
    }).then((res) => {
      // TODO: "res.data.data.delete" should emit "image-uploaded"/handleUploadedImage in editor.js. Maybe add to image manager too.
      // This notification will be removed when the image manager implemented.
      const notice = new Notification('Copy delete URL', {
        body: 'Click to copy the delete URL to clipboard.'
      })

      notice.onclick = () => {
        clipboard.writeText(res.data.data.delete)
      }

      re(res.data.data.url)
    })
      .catch(_ => {
        rj('Upload failed, the image will be copied to the image folder')
      })
  }

  const uploadByGithub = (content, filename) => {
    const octokit = new Octokit({
      auth: `token ${token}`
    })
    const path = dayjs().format('YYYY/MM') + `/${dayjs().format('DD-HH-mm-ss')}-${filename}`
    const message = `Upload by MarkText at ${dayjs().format('YYYY-MM-DD HH:mm:ss')}`
    const payload = {
      owner,
      repo,
      path,
      branch,
      message,
      content
    }
    if (!branch) {
      delete payload.branch
    }
    octokit.repos.createOrUpdateFileContents(payload).then(result => {
      re(result.data.content.download_url)
    })
      .catch(_ => {
        rj('Upload failed, the image will be copied to the image folder')
      })
  }

  const notification = () => {
    rj('Cannot upload more than 5M image, the image will be copied to the image folder')
  }

  if (isPath) {
    const dirname = path.dirname(pathname)
    const imagePath = path.resolve(dirname, image)
    const isImage = isImageFile(imagePath)
    if (isImage) {
      const { size } = await fs.stat(imagePath)
      if (size > MAX_SIZE) {
        notification()
      } else {
        const imageFile = await fs.readFile(imagePath)
        const blobFile = new Blob([imageFile])
        if (currentUploader === 'smms') {
          uploadToSMMS(blobFile)
        } else {
          const base64 = Buffer.from(imageFile).toString('base64')
          uploadByGithub(base64, path.basename(imagePath))
        }
      }
    } else {
      re(image)
    }
  } else {
    const { size } = image
    if (size > MAX_SIZE) {
      notification()
    } else {
      const reader = new FileReader()
      reader.onload = async () => {
        const blobFile = dataURItoBlob(reader.result, image.name)
        if (currentUploader === 'smms') {
          uploadToSMMS(blobFile)
        } else {
          uploadByGithub(reader.result, image.name)
        }
      }

      reader.readAsDataURL(image)
    }
  }

  return promise
}
