import { isEqualAccelerator } from 'common/keybinding'
import getCommandDescriptionById from '@/commands/descriptions'
import { isOsx } from '@/util'

const SHORTCUT_TYPE_DEFAULT = 0
const SHORTCUT_TYPE_USER = 1

type ShortcutType = typeof SHORTCUT_TYPE_DEFAULT | typeof SHORTCUT_TYPE_USER

export interface UiKeybinding {
  id: string
  description: string
  accelerator: string
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

  /**
   * ctor
   */
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
      if (!isOsx && id.startsWith('mt.')) {
        // Skip MarkText menu that is only available on macOS.
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
      type = SHORTCUT_TYPE_USER
      accelerator = userAccelerator
    } else {
      accelerator = defaultKeybindings.get(id) ?? ''
    }
    return { id, description, accelerator, type }
  }

  getKeybindings(): UiKeybinding[] {
    return this.keybindingList
  }

  // Rebuild the keybinding list to update descriptions on language switch
  rebuildKeybindingList(): UiKeybinding[] {
    // Save the current user settings
    const userKeybindings = this._getUserKeybindingMap()
    // Rebuild the list
    this.keybindingList = this._buildUiKeybindingList(this.defaultKeybindings, userKeybindings)
    return this.keybindingList
  }

  async save(): Promise<boolean> {
    if (!this.isDirty) {
      return true
    }

    const userKeybindings = this._getUserKeybindingMap()
    // The main-process handler returns Promise<boolean>, but the IPC contract
    // currently types `ret` as void; rely on the runtime value.
    const result = (await window.electron.ipcRenderer.invoke(
      'mt::keybinding-save-user-keybindings',
      userKeybindings
    )) as unknown as boolean
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

    if (accelerator && this._isDuplicate(accelerator)) {
      return false
    }

    entry.accelerator = accelerator
    entry.type = this._isDefaultBinding(id, accelerator)
      ? SHORTCUT_TYPE_DEFAULT
      : SHORTCUT_TYPE_USER
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

  _isDuplicate(accelerator: string): boolean {
    return (
      accelerator !== '' &&
      this.keybindingList.findIndex((entry) =>
        isEqualAccelerator(entry.accelerator, accelerator)
      ) !== -1
    )
  }

  _isDefaultBinding(id: string, accelerator: string): boolean {
    return this.defaultKeybindings.get(id) === accelerator
  }
}
