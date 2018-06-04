import fse from 'fs-extra'
import path from 'path'
import { LINE_ENDING_REG, LF_LINE_ENDING_REG, CRLF_LINE_ENDING_REG, isWindows } from '../config'
import userPreference from '../preference'

export const getOsLineEndingName = () => {
  const { endOfLine } = userPreference.getAll()
  if (endOfLine === 'lf') {
    return 'lf'
  }
  return endOfLine === 'crlf' || isWindows ? 'crlf' : 'lf'
}

const getLineEnding = lineEnding => {
  if (lineEnding === 'lf') {
    return '\n'
  } else if (lineEnding === 'crlf') {
    return '\r\n'
  }
  return getOsLineEndingName() === 'crlf' ? '\r\n' : '\n'
}

const convertLineEndings = (text, lineEnding) => {
  return text.replace(LINE_ENDING_REG, getLineEnding(lineEnding))
}

export const writeFile = (pathname, content, extension) => {
  if (!pathname) {
    const errMsg = '[ERROR] Cannot save file without path.'
    return Promise.reject(errMsg)
  }
  pathname = !extension || pathname.endsWith(extension) ? pathname : `${pathname}${extension}`

  return fse.outputFile(pathname, content, 'utf-8')
}

export const writeMarkdownFile = (pathname, content, options, win) => {
  const { adjustLineEndingOnSave, isUtf8BomEncoded, lineEnding } = options
  const extension = path.extname(pathname) || '.md'

  if (isUtf8BomEncoded) {
    content = '\uFEFF' + content
  }

  if (adjustLineEndingOnSave) {
    content = convertLineEndings(content, lineEnding)
  }

  return writeFile(pathname, content, extension)
}

export const loadMarkdownFile = async pathname => {
  let markdown = await fse.readFile(path.resolve(pathname), 'utf-8')
  // Check UTF-8 BOM (EF BB BF) encoding
  const isUtf8BomEncoded = markdown.length >= 1 && markdown.charCodeAt(0) === 0xFEFF
  if (isUtf8BomEncoded) {
    markdown = markdown.slice(1)
  }

  // Detect line ending
  const isLf = LF_LINE_ENDING_REG.test(markdown)
  const isCrlf = CRLF_LINE_ENDING_REG.test(markdown)
  const isMixed = isLf && isCrlf
  const isUnknownEnding = !isLf && !isCrlf
  let lineEnding = getOsLineEndingName()
  if (isLf && !isCrlf) {
    lineEnding = 'lf'
  } else if (isCrlf && !isLf) {
    lineEnding = 'crlf'
  }

  let adjustLineEndingOnSave = false
  if (isMixed || isUnknownEnding || lineEnding !== 'lf') {
    adjustLineEndingOnSave = lineEnding !== 'lf'
    // Convert to LF for internal use.
    markdown = convertLineEndings(markdown, 'lf')
  }

  const filename = path.basename(pathname)

  return {
    markdown,
    filename,
    pathname,
    isUtf8BomEncoded,
    lineEnding,
    adjustLineEndingOnSave,
    isMixed
  }
}

// load project and return a tree structure (no used)
// export const loadProject = async pathname => {
//   const name = path.basename(pathname)
//   const rootNode = {
//     pathname,
//     name,
//     isDirctory: true,
//     isFile: false,
//     isMarkdown: false,
//     folders: [],
//     files: []
//   }

//   const readDir = async (dir, node) => {
//     const readdir = promisify(fs.readdir)
//     try {
//       const lists = await readdir(dir)
//       const promises = lists
//         .filter(name => PROJECT_BLACK_LIST.indexOf(name) === -1)
//         .filter(name => {
//           const fullPath = path.join(dir, name)
//           return isFile(fullPath) || isDirectory(fullPath)
//         })
//         .map(async name => {
//           const fullPath = path.join(dir, name)
//           const stats = await promisify(fs.stat)(fullPath)
//           const iFile = isFile(fullPath)
//           const iDirctory = isDirectory(fullPath)
//           const birthTime = stats.birthtime
//           const isMarkdown = hasMarkdownExtension(fullPath)

//           if (iFile) {
//             const file = {
//               pathname: fullPath,
//               name,
//               isDirctory: iDirctory,
//               isFile: iFile,
//               birthTime,
//               isMarkdown
//             }
//             if (isMarkdown) {
//               file.data = await loadMarkdownFile(fullPath)
//             }
//             node.files.push(file)
//             return file
//           } else if (iDirctory) {
//             const folder = {
//               pathname: fullPath,
//               name,
//               isDirctory: iDirctory,
//               isCollapsed: true,
//               isFile: iFile,
//               isMarkdown,
//               folders: [],
//               files: []
//             }
//             node.folders.push(folder)
//             return readDir(fullPath, folder)
//           }
//         })
//       return Promise.all(promises)
//     } catch (err) {
//       log(err)
//       return Promise.reject(err)
//     }
//   }

//   await readDir(pathname, rootNode)

//   return rootNode
// }
