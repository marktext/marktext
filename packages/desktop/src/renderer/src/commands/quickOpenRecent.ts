import bus from '../bus'
import { delay } from '@/util'
import getCommandDescriptionById from './descriptions'
import { t } from '../i18n'
import type { RecentDocument } from '@shared/types/ipc'

interface RecentSubcommand {
  id: string
  description: string
  detail: string
  title: string
  group: string
  removable: boolean
  isDirectory: boolean
}

class QuickOpenRecentCommand {
  id: string
  description: string
  placeholder: string
  shortcut: string | null
  subcommands: RecentSubcommand[]
  subcommandSelectedIndex: number

  constructor() {
    this.id = 'file.quick-open-recent'
    this.description = getCommandDescriptionById('file.quick-open-recent')
    this.placeholder = t('commandPalette.placeholders.searchRecentFilesAndFolders')
    this.shortcut = null

    this.subcommands = []
    this.subcommandSelectedIndex = -1
  }

  run = async(): Promise<void> => {
    const documents = await this._getRecentDocuments()
    const folderGroup = t('commandPalette.folders')
    const fileGroup = t('commandPalette.files')

    this.subcommands = [
      ...documents
        .filter((document) => document.isDirectory)
        .map((document) => this._toItem(document, folderGroup)),
      ...documents
        .filter((document) => !document.isDirectory)
        .map((document) => this._toItem(document, fileGroup))
    ]
    this.subcommandSelectedIndex = this.subcommands.length ? 0 : -1
  }

  search = async(query: string): Promise<RecentSubcommand[]> => {
    const needle = query.trim().toLowerCase()
    if (!needle) return this.subcommands

    return this.subcommands.filter(
      (item) =>
        item.description.toLowerCase().includes(needle) ||
        item.title.toLowerCase().includes(needle)
    )
  }

  execute = async(): Promise<void> => {
    // Timeout to hide the command palette and then show again to prevent issues.
    await delay(100)
    bus.emit('show-command-palette', this)
  }

  executeSubcommand = async(id: string): Promise<void> => {
    const { windowId } = window.marktext!.env!
    const item = this.subcommands.find((entry) => entry.id === id)

    if (item?.isDirectory) {
      window.electron.ipcRenderer.send('app-open-directory-by-id', windowId, id)
    } else {
      window.electron.ipcRenderer.send('mt::open-file-by-window-id', windowId, id)
    }
  }

  removeItem = (id: string): void => {
    this.subcommands = this.subcommands.filter((item) => item.id !== id)
    window.electron.ipcRenderer.send('mt::remove-recently-used-document', id)
  }

  unload = (): void => {
    this.subcommands = []
  }

  private _getRecentDocuments = async(): Promise<RecentDocument[]> => {
    try {
      return await window.electron.ipcRenderer.invoke('mt::get-recently-used-documents')
    } catch {
      return []
    }
  }

  private _toItem = (document: RecentDocument, group: string): RecentSubcommand => ({
    id: document.pathname,
    description: window.path.basename(document.pathname),
    detail: window.path.dirname(document.pathname),
    title: document.pathname,
    group,
    removable: true,
    isDirectory: document.isDirectory
  })
}

export default QuickOpenRecentCommand
