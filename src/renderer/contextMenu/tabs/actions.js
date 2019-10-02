import bus from '../../bus'

export const closeThis = (tab) => {
  bus.$emit('TABS::close-this', tab)
}

export const closeOthers = (tab) => {
  bus.$emit('TABS::close-others', tab)
}

export const closeSaved = () => {
  bus.$emit('TABS::close-saved')
}

export const closeAll = () => {
  bus.$emit('TABS::close-all')
}

export const rename = (tab) => {
  bus.$emit('TABS::rename', tab)
}

export const copyPath = (tab) => {
  bus.$emit('TABS::copy-path', tab)
}

export const showInFolder = (tab) => {
  bus.$emit('TABS::show-in-folder', tab)
}
