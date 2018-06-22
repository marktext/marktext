import path from 'path'

export const isOsx = process.platform === 'darwin'
export const isWindows = process.platform === 'win32'
export const isLinux = process.platform === 'linux'

export const defaultWinOptions = {
  icon: path.join(__static, 'logo-96px.png'),
  minWidth: 450,
  minHeight: 220,
  webPreferences: {
    webSecurity: false
  },
  useContentSize: true,
  show: false,
  frame: false,
  titleBarStyle: 'hidden'
}

export const EXTENSIONS = [
  'markdown',
  'mdown',
  'mkdn',
  'md',
  'mkd',
  'mdwn',
  'mdtxt',
  'mdtext',
  'text',
  'txt'
]

export const IMAGE_EXTENSIONS = [
  'jpeg',
  'jpg',
  'png',
  'gif',
  'svg',
  'webp'
]

// export const PROJECT_BLACK_LIST = [
//   'node_modules',
//   '.git',
//   '.DS_Store'
// ]

export const BLACK_LIST = [
  '$RECYCLE.BIN'
]

export const EXTENSION_HASN = {
  styledHtml: '.html',
  html: '.html',
  pdf: '.pdf'
}

export const TITLE_BAR_HEIGHT = isOsx ? 21 : 25
export const LINE_ENDING_REG = /(?:\r\n|\n)/g
export const LF_LINE_ENDING_REG = /(?:[^\r]\n)|(?:^\n$)/
export const CRLF_LINE_ENDING_REG = /\r\n/
