import bus from '../../bus'

export const closeThis = (tabId: string): void => {
  bus.emit('TABS::close-this', tabId)
}

export const closeOthers = (tabId: string): void => {
  bus.emit('TABS::close-others', tabId)
}

export const closeSaved = (): void => {
  bus.emit('TABS::close-saved')
}

export const closeAll = (): void => {
  bus.emit('TABS::close-all')
}

export const rename = (tabId: string): void => {
  bus.emit('TABS::rename', tabId)
}

export const copyPath = (tabId: string): void => {
  bus.emit('TABS::copy-path', tabId)
}

export const showInFolder = (tabId: string): void => {
  bus.emit('TABS::show-in-folder', tabId)
}
