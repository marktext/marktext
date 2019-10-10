import bus from '../../bus'

export const closeThis = (tabId) => {
  bus.$emit('TABS::close-this', tabId)
}

export const closeOthers = (tabId) => {
  bus.$emit('TABS::close-others', tabId)
}

export const closeSaved = () => {
  bus.$emit('TABS::close-saved')
}

export const closeAll = () => {
  bus.$emit('TABS::close-all')
}

export const rename = (tabId) => {
  bus.$emit('TABS::rename', tabId)
}

export const copyPath = (tabId) => {
  bus.$emit('TABS::copy-path', tabId)
}

export const showInFolder = (tabId) => {
  bus.$emit('TABS::show-in-folder', tabId)
}
