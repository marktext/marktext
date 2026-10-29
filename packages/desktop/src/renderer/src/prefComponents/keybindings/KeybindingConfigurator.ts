import { isEqualAccelerator } from 'common/keybinding'
import getCommandDescriptionById from '@/commands/descriptions'
import { isMac } from '@/util'

const SHORTCUT_TYPE_DEFAULT = 0
const SHORTCUT_TYPE_USER = 1

type ShortcutType = typeof SHORTCUT_TYPE_DEFAULT | typeof SHORTCUT_TYPE_USER

export interface UiKeybinding {
  id: string
  description: string
  accelerator: string
  defaultAccelerator: string
  type: ShortcutType
}

const getShortcutDescriptionById = (id: string): string => {
  const description = getCommandDescriptionById(id)
  if (!description) {
    return id
  }
  return description
}

export default class KeybindingConfigurator {
  defaultKeybindings: Map<string, string>
  keybindingList: UiKeybinding[]
  isDirty: boolean

  constructor(defaultKeybindings: Map<string, string>, userKeybindings: Map<string, string>) {
    this.defaultKeybindings = defaultKeybindings
    this.keybindingList = this._buildUiKeybindingList(defaultKeybindings, userKeybindings)
    this.isDirty = false
  }

  _buildUiKeybindingList(
    defaultKeybindings: Map<string, string>,
    userKeybindings: Map<string, string>
  ): UiKeybinding[] {
    const uiKeybindings: UiKeybinding[] = []
    for (const [id] of defaultKeybindings) {
      if (!isMac && id.startsWith('mt.')) {
        continue
      }
      uiKeybindings.push(this._toUiKeybinding(id, defaultKeybindings, userKeybindings))
    }
    uiKeybindings.sort((a, b) => a.description.localeCompare(b.description))
    return uiKeybindings
  }

  _toUiKeybinding(
    id: string,
    defaultKeybindings: Map<string, string>,
    userKeybindings: Map<string, string>
  ): UiKeybinding {
    const description = getShortcutDescriptionById(id)
    const userAccelerator = userKeybindings.get(id)
    let type: ShortcutType = SHORTCUT_TYPE_DEFAULT

    // Overwrite accelerator if key is present (empty string unset old binding).
    let accelerator: string
    if (userAccelerator != null) {
      const isDefault = this._isDefaultBinding(id, userAccelerator)
      type = isDefault ? SHORTCUT_TYPE_DEFAULT : SHORTCUT_TYPE_USER
      accelerator = isDefault ? defaultKeybindings.get(id) ?? '' : userAccelerator
    } else {
      accelerator = defaultKeybindings.get(id) ?? ''
    }
    return { id, description, accelerator, defaultAccelerator: defaultKeybindings.get(id) ?? '', type }
  }

  getKeybindings(): UiKeybinding[] {
    return this.keybindingList
  }

  rebuildKeybindingList(): UiKeybinding[] {
    const userKeybindings = this._getUserKeybindingMap()
    this.keybindingList = this._buildUiKeybindingList(this.defaultKeybindings, userKeybindings)
    return this.keybindingList
  }

  async save(): Promise<boolean> {
    if (!this.isDirty) {
      return true
    }

    const userKeybindings = this._getUserKeybindingMap()
    const result = await window.electron.ipcRenderer.invoke(
      'mt::keybinding-save-user-keybindings',
      userKeybindings
    )
    if (result) {
      this.isDirty = false
      return true
    }
    return false
  }

  _getUserKeybindingMap(): Map<string, string> {
    const userKeybindings = new Map<string, string>()
    for (const entry of this.keybindingList) {
      const { id, accelerator, type } = entry
      if (type !== SHORTCUT_TYPE_DEFAULT) {
        userKeybindings.set(id, accelerator)
      }
    }
    return userKeybindings
  }

  change(id: string, accelerator: string): boolean {
    const entry = this.keybindingList.find((entry) => entry.id === id)
    if (!entry) {
      return false
    }

    if (accelerator && this._isDuplicate(id, accelerator)) {
      return false
    }

    const isDefault = this._isDefaultBinding(id, accelerator)
    entry.accelerator = isDefault ? entry.defaultAccelerator : accelerator
    entry.type = isDefault ? SHORTCUT_TYPE_DEFAULT : SHORTCUT_TYPE_USER
    this.isDirty = true
    return true
  }

  unbind(id: string): boolean {
    return this.change(id, '')
  }

  resetToDefault(id: string): boolean {
    const accelerator = this.defaultKeybindings.get(id)
    if (accelerator == null) {
      // allow empty string
      return false
    }
    return this.change(id, accelerator)
  }

  async resetAll(): Promise<boolean> {
    const { defaultKeybindings, keybindingList } = this
    for (const entry of keybindingList) {
      const defaultAccelerator = defaultKeybindings.get(entry.id)
      if (defaultAccelerator) {
        entry.accelerator = defaultAccelerator
      } else {
        entry.accelerator = ''
      }
      entry.type = SHORTCUT_TYPE_DEFAULT
    }
    this.isDirty = true
    return this.save()
  }

  getDefaultAccelerator(id: string): string | undefined {
    return this.defaultKeybindings.get(id)
  }

  getConflicts(id: string, accelerator: string): UiKeybinding[] {
    if (!accelerator) return []
    return this.keybindingList.filter(entry =>
      entry.id !== id && isEqualAccelerator(entry.accelerator, accelerator)
    )
  }

  _isDuplicate(id: string, accelerator: string): boolean {
    return this.getConflicts(id, accelerator).length > 0
  }

  _isDefaultBinding(id: string, accelerator: string): boolean {
    const defaultAccelerator = this.defaultKeybindings.get(id) ?? ''
    if (!defaultAccelerator || !accelerator) return defaultAccelerator === accelerator
    return isEqualAccelerator(defaultAccelerator, accelerator)
  }
}
