import { app } from 'electron'

const ID_PREFIX = 'mt-'
let id = 0

export const getUniqueId = () => {
  return `${ID_PREFIX}${id++}`
}

// TODO: Remove this function and load the recommend title from the editor (renderer) when
// requesting the document to save/export.
export const getRecommendTitleFromMarkdownString = markdown => {
  // NOTE: We should read the title from the renderer cache because this regex matches in
  // code blocks too.
  const tokens = markdown.match(/#{1,6} {1,}(.*\S.*)(?:\n|$)/g)
  if (!tokens) return ''
  const headers = tokens.map(t => {
    const matches = t.trim().match(/(#{1,6}) {1,}(.+)/)
    return {
      level: matches[1].length,
      content: matches[2].trim()
    }
  })
  return headers.sort((a, b) => a.level - b.level)[0].content
}

/**
 * Returns a special directory path for the requested name.
 *
 * NOTE: Do not use "userData" to get the user data path, instead use AppPaths!
 *
 * @param {string} name The special directory name.
 * @returns {string} The resolved special directory path.
 */
export const getPath = name => {
  if (name === 'userData') {
    throw new Error('Do not use "getPath" for user data path!')
  }
  return app.getPath(name)
}

export const hasSameKeys = (a, b) => {
  const aKeys = Object.keys(a).sort()
  const bKeys = Object.keys(b).sort()
  return JSON.stringify(aKeys) === JSON.stringify(bKeys)
}

export const getLogLevel = () => {
  if (!global.MARKTEXT_DEBUG_VERBOSE || typeof global.MARKTEXT_DEBUG_VERBOSE !== 'number' ||
    global.MARKTEXT_DEBUG_VERBOSE <= 0) {
    return process.env.NODE_ENV === 'development' ? 'debug' : 'info'
  } else if (global.MARKTEXT_DEBUG_VERBOSE === 1) {
    return 'verbose'
  } else if (global.MARKTEXT_DEBUG_VERBOSE === 2) {
    return 'debug'
  }
  return 'silly' // >= 3
}
