export const isOsx = process.platform === 'darwin'
export const isWindows = process.platform === 'win32'
export const isLinux = process.platform === 'linux'

export const editorWinOptions = {
  minWidth: 450,
  minHeight: 220,
  webPreferences: {
    nodeIntegration: true,
    webSecurity: false
  },
  useContentSize: true,
  show: true,
  frame: false,
  titleBarStyle: 'hiddenInset'
}

export const defaultPreferenceWinOptions = {
  width: 950,
  height: 650,
  webPreferences: {
    nodeIntegration: true,
    webSecurity: false,
  },
  fullscreenable: false,
  fullscreen: false,
  resizable: false,
  minimizable: false,
  maximizable: false,
  useContentSize: true,
  show: false,
  frame: false,
  thickFrame: !isOsx,
  titleBarStyle: 'hiddenInset'
}

export const PANDOC_EXTENSIONS = [
  'html',
  'docx',
  'latex',
  'tex',
  'ltx',
  'rst',
  'rest',
  'org',
  'wiki',
  'dokuwiki',
  'textile',
  'opml',
  'epub'
]

export const BLACK_LIST = [
  '$RECYCLE.BIN'
]

export const EXTENSION_HASN = {
  styledHtml: '.html',
  pdf: '.pdf'
}

export const TITLE_BAR_HEIGHT = isOsx ? 21 : 32
export const LINE_ENDING_REG = /(?:\r\n|\n)/g
export const LF_LINE_ENDING_REG = /(?:[^\r]\n)|(?:^\n$)/
export const CRLF_LINE_ENDING_REG = /\r\n/

export const GITHUB_REPO_URL = 'https://github.com/marktext/marktext'
// copy from muya
export const URL_REG = /^http(s)?:\/\/([a-z0-9\-._~]+\.[a-z]{2,}|[0-9.]+|localhost|\[[a-f0-9.:]+\])(:[0-9]{1,5})?(\/[\S]+)?/i
