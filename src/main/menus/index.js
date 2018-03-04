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

export default function configureMenu ({ app }) {
  let template = process.platform === 'darwin' ? [marktext({ app })] : []

  return [
    ...template,
    file,
    edit,
    paragraph,
    format,
    windowMenu,
    theme,
    view,
    help
  ]
}
