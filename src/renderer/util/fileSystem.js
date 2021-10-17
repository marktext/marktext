import path from 'path'
import crypto from 'crypto'
import { clipboard } from 'electron'
import fs from 'fs-extra'
import dayjs from 'dayjs'
import { Octokit } from '@octokit/rest'
import { ensureDirSync } from 'common/filesystem'
import { isImageFile } from 'common/filesystem/paths'
// import { dataURItoBlob } from './index'
import axios from '../axios'
import urlJoin from 'url-join'

const os = require('os')
var FormData = require('form-data')

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
  ensureDirSync(absPath)

  const dstPath = path.resolve(absPath, path.basename(imagePath))
  await fs.move(imagePath, dstPath, { overwrite: true })
  return dstPath
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
  const { owner, repo, branch, email } = preferences.imageBed.github
  const githubToken = preferences.githubToken
  const smmsToken = preferences.smmsToken
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

  const uploadToSMMS = imagePath => {
    const api = 'https://sm.ms/api/v2/upload'
    const formData = new FormData()
    const formHeaders = formData.getHeaders()

    console.log(imagePath)
    formData.append('smfile', fs.createReadStream(imagePath))
    axios({
      method: 'post',
      url: api,
      data: formData,
      headers: {
        ...formHeaders,
        Authorization: smmsToken,
        'Content-Type': `multipart/form-data; boundary=${formData._boundary}`
      }
    }).then((res) => {
      // del tmp file
      console.log(res)
      if (imagePath.indexOf(os.tmpdir()) !== -1) {
        console.log('tmp file')
        fs.unlinkSync(imagePath)
      }
      if (res.data.code && res.data.code.indexOf('repeated') !== -1) {
        console.log('图片重复了')
        re(res.data.images)
      } else {
        // TODO: "res.data.data.delete" should emit "image-uploaded"/handleUploadedImage in editor.js. Maybe add to image manager too.
        // This notification will be removed when the image manager implemented.
        const notice = new Notification('Copy delete URL', {
          body: 'Click to copy the delete URL to clipboard.'
        })

        notice.onclick = () => {
          clipboard.writeText(res.data.data.delete)
        }
        re(res.data.data.url)
      }
    })
      .catch(err => {
        console.log('err', err)
        rj('Upload failed, the image will be copied to the image folder')
      })
  }

  const uploadByGithub = (content, filename) => {
    console.log('github token: ', githubToken)
    const octokit = new Octokit({
      auth: githubToken,
      log: {
        debug: (res) => { console.log(res) },
        info: (res) => { console.log(res) },
        warn: (res) => { console.log(res) },
        error: (res) => { console.log(res) }
      }
    })

    const path = dayjs().format('YYYY/MM') + `/${dayjs().format('DD-HH-mm-ss')}-${filename}`
    const message = `Upload by Mark Text at ${dayjs().format('YYYY-MM-DD HH:mm:ss')}`
    var payload = {
      owner,
      repo,
      path,
      message,
      content,
      'committer.name': owner,
      'committer.email': email,
      'author.Name': owner,
      'authoer.email': email,
      branch
    }
    console.log(payload)
    if (!branch) {
      delete payload.branch
    }
    octokit.rest.repos.createOrUpdateFileContents(payload).then(result => {
      console.log('github reply: ', result)
      re(result.data.content.download_url)
    })
      .catch(err => {
        console.log('github err: ', err)
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
      .catch(err => {
        console.log('github err: ', err)
        rj(`Upload failed, the image will be copied to the image folder, ${err}`)
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
        // const blobFile = new Blob([imageFile])
        console.log('imagePath: ', imagePath)
        if (currentUploader === 'smms') {
          uploadToSMMS(imagePath)
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
        // const blobFile = dataURItoBlob(reader.result, image.name)
        const imageData = reader.result.replace(/^data:image\/\w+;base64,/, '')
        const dataBuffer = Buffer.from(imageData, 'base64')
        // const imagePath = tempWrite.sync('unicorn', image.name)
        const imagePath = path.resolve(os.tmpdir(), image.name)
        console.log('imagePath: ', imagePath)

        fs.writeFile(imagePath, dataBuffer, function (err) {
          if (err) {
            console.log('save img error：', err)
          } else {
            console.log('save img success!')
          }
        })
        const imageFile = await fs.readFile(imagePath)
        const imageBase64 = Buffer.from(imageFile).toString('base64')
        if (currentUploader === 'smms') {
          uploadToSMMS(imagePath)
        } else if (currentUploader === 'gitee') {
          uploadByGitee(imageBase64, image.name)
        } else {
          uploadByGithub(imageBase64, image.name)
        }
      }

      reader.readAsDataURL(image)
    }
  }

  return promise
}
