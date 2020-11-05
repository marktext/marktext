import path from 'path'
import { clipboard } from 'electron'
import fse from 'fs-extra'
import dayjs from 'dayjs'
import Octokit from '@octokit/rest'
import { isImageFile } from 'common/filesystem/paths'
import { dataURItoBlob, getContentHash } from './index'
import axios from '../axios'
import urlJoin from 'url-join'

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

export const moveImageToFolder = async (pathname, image, dir) => {
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
      await fse.copy(imagePath, hashFilePath)
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
    await fse.writeFile(imagePath, binaryString, 'binary')
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
  const gitee = preferences.imageBed.gitee
  const giteeToken = preferences.giteeToken
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
    const message = `Upload by Mark Text at ${dayjs().format('YYYY-MM-DD HH:mm:ss')}`
    var payload = {
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
    octokit.repos.createFile(payload).then(result => {
      re(result.data.content.download_url)
    })
      .catch(_ => {
        rj('Upload failed, the image will be copied to the image folder')
      })
  }

  const uploadByGitee = (content, fileName) => {
    const path = dayjs().format('YYYY/MM')
    const filename = `${dayjs().format('DD-HH-mm-ss')}-${fileName}`
    const message = `Upload by Mark Text at ${dayjs().format('YYYY-MM-DD HH:mm:ss')}`
    const url = encodeURI(urlJoin(
      'https://gitee.com/api/v5',
      'repos', gitee.owner, gitee.repo, 'contents', path, filename
    ))
    var branch = gitee.branch || 'master'
    const formData = {
      access_token: giteeToken,
      content: content,
      message: message,
      branch: branch
    }
    axios({
      method: 'post',
      url: url,
      json: true,
      resolveWithFullResponse: true,
      data: formData
    }).then((res) => {
      if (res && res.status === 201) {
        re(res.data.content.download_url)
      }
    })
      .catch(e => {
        rj(`Upload failed, the image will be copied to the image folder, ${e}`)
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
      const { size } = await fse.stat(imagePath)
      if (size > MAX_SIZE) {
        notification()
      } else {
        const imageFile = await fse.readFile(imagePath)
        const blobFile = new Blob([imageFile])
        if (currentUploader === 'smms') {
          uploadToSMMS(blobFile)
        } else if (currentUploader === 'gitee') {
          const base64 = Buffer.from(imageFile).toString('base64')
          uploadByGitee(base64, path.basename(imagePath))
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
        } else if (currentUploader === 'gitee') {
          uploadByGitee(reader.result, image.name)
        } else {
          uploadByGithub(reader.result, image.name)
        }
      }

      reader.readAsDataURL(image)
    }
  }

  return promise
}
