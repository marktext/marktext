import edit from './edit'
import file from './file'
import help from './help'
import marktext from './marktext'
import view from './view'
import windowMenu from './windowMenu'
import paragraph from './paragraph'
import format from './format'
import theme from './theme'

export dockMenu from './dock'

export default function (recentlyUsedFiles) {
  return [
    ...(process.platform === 'darwin' ? [marktext] : []),
    file(recentlyUsedFiles),
    edit,
    paragraph,
    format,
    windowMenu,
    theme,
    view,
    help
  ]
}
