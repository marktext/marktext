import path from 'path'
import crypto from 'crypto'
import { clipboard } from 'electron'
import fs from 'fs-extra'
import { statSync, constants } from 'fs'
import cp from 'child_process'
import { tmpdir } from 'os'
import dayjs from 'dayjs'
import { Octokit } from '@octokit/rest'
import { isImageFile } from 'common/filesystem/paths'
import { isWindows, dataURItoBlob } from './index'
import axios from '../axios'

export const create = async (pathname, type) => {
  return type === 'directory'
    ? await fs.ensureDir(pathname)
    : await fs.outputFile(pathname, '')
}

export const paste = async ({ src, dest, type }) => {
  return type === 'cut'
    ? await fs.move(src, dest)
    : await fs.copy(src, dest)
}

export const rename = async (src, dest) => {
  return await fs.move(src, dest)
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
  await fs.ensureDir(absPath)
  await fs.move(imagePath, dstPath, { overwrite: true })

  // dstRelPath: relative directory name + image file name
  const dstRelPath = path.join(relativeName, path.basename(imagePath))

  if (isWindows) {
    // Use forward slashes for better compatibility with websites.
    return dstRelPath.replace(/\\/g, '/')
  }
  return dstRelPath
}

export const moveImageToFolder = async (pathname, image, outputDir) => {
  await fs.ensureDir(outputDir)
  const isPath = typeof image === 'string'
  if (isPath) {
    const dirname = path.dirname(pathname)
    const imagePath = path.resolve(dirname, image)
    const isImage = isImageFile(imagePath)
    if (isImage) {
      const filename = path.basename(imagePath)
      const extname = path.extname(imagePath)
      const noHashPath = path.join(outputDir, filename)
      if (noHashPath === imagePath) {
        return imagePath
      }
      const hash = getContentHash(imagePath)
      // To avoid name conflict.
      const hashFilePath = path.join(outputDir, `${hash}${extname}`)
      await fs.copy(imagePath, hashFilePath)
      return hashFilePath
    } else {
      return Promise.resolve(image)
    }
  } else {
    const imagePath = path.join(outputDir, `${dayjs().format('YYYY-MM-DD-HH-mm-ss')}-${image.name}`)
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
  const { currentUploader, imageBed, githubToken: token, cliScript } = preferences
  const { owner, repo, branch } = imageBed.github
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
    octokit.repos.createOrUpdateFileContents(payload)
      .then(result => {
        re(result.data.content.download_url)
      })
      .catch(_ => {
        rj('Upload failed, the image will be copied to the image folder')
      })
  }

  const uploadByCliScript = async (filepath) => {
    let isPath = true
    if (typeof filepath !== 'string') {
      isPath = false
      const data = new Uint8Array(filepath)
      filepath = path.join(tmpdir(), +new Date())
      await fs.writeFile(filepath, data)
    }
    cp.execFile(cliScript, [filepath], async (err, data) => {
      if (!isPath) {
        await fs.unlink(filepath)
      }
      if (err) {
        return rj(err)
      }
      re(data.trim())
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
        if (currentUploader === 'cliScript') {
          uploadByCliScript(imagePath)
          return promise
        }
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
        switch (currentUploader) {
          case 'cliScript':
            uploadByCliScript(reader.result, image.name)
            break
          case 'smms':
            uploadToSMMS(dataURItoBlob(reader.result, image.name))
            break
          default:
            uploadByGithub(reader.result, image.name)
        }
      }

      const readerFunction = currentUploader === 'cliScript' ? 'readAsArrayBuffer' : 'readAsDataURL'
      reader[readerFunction](image)
    }
  }
  return promise
}

export const isFileExecutableSync = (filepath) => {
  try {
    const stat = statSync(filepath)
    return stat.isFile() && (stat.mode & (constants.S_IXUSR | constants.S_IXGRP | constants.S_IXOTH)) !== 0
  } catch (err) {
    // err ignored
    return false
  }
}
