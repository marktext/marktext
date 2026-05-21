import { registerWindowHandlers } from './window'
import { registerContextMenuHandlers } from './contextMenu'
import { registerClipboardHandlers } from './clipboard'
import { registerFilesystemHandlers } from './filesystem'
import { registerSearchHandlers } from './search'
import { registerUploadHandlers } from './upload'

export function registerNodeServiceHandlers(accessor) {
  registerWindowHandlers()
  registerContextMenuHandlers()
  registerClipboardHandlers()
  registerFilesystemHandlers(accessor)
  registerSearchHandlers(accessor)
  registerUploadHandlers(accessor)
}
