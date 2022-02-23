import { ipcRenderer } from 'electron'
import { isEqualAccelerator } from 'common/keybinding'
import getCommandDescriptionById from '@/commands/descriptions'
import { isOsx } from '@/util'

const SHORTCUT_TYPE_DEFAULT = 0
const SHORTCUT_TYPE_USER = 1

const getShortcutDescriptionById = id => {
  const description = getCommandDescriptionById(id)
  if (!description) {
    return id
  }
  return description
}

export default class KeybindingConfigurator {
  /**
   * ctor
   *
   * @param {Map<String, String>} defaultKeybindings
   * @param {Map<String, String>} userKeybindings
   */
  constructor (defaultKeybindings, userKeybindings) {
    this.defaultKeybindings = defaultKeybindings
    this.keybindingList = this._buildUiKeybindingList(defaultKeybindings, userKeybindings)
    this.isDirty = false
  }

  _buildUiKeybindingList (defaultKeybindings, userKeybindings) {
    const uiKeybindings = []
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

  _toUiKeybinding (id, defaultKeybindings, userKeybindings) {
    const description = getShortcutDescriptionById(id)
    const userAccelerator = userKeybindings.get(id)
    let type = SHORTCUT_TYPE_DEFAULT

    // Overwrite accelerator if key is present (empty string unset old binding).
    let accelerator
    if (userAccelerator != null) {
      type = SHORTCUT_TYPE_USER
      accelerator = userAccelerator
    } else {
      accelerator = defaultKeybindings.get(id)
    }
    return { id, description, accelerator, type }
  }

  getKeybindings () {
    return this.keybindingList
  }

  async save () {
    if (!this.isDirty) {
      return true
    }

    const userKeybindings = this._getUserKeybindingMap()
    const result = await ipcRenderer.invoke('mt::keybinding-save-user-keybindings', userKeybindings)
    if (result) {
      this.isDirty = false
      return true
    }
    return false
  }

  _getUserKeybindingMap () {
    const userKeybindings = new Map()
    for (const entry of this.keybindingList) {
      const { id, accelerator, type } = entry
      if (type !== SHORTCUT_TYPE_DEFAULT) {
        userKeybindings.set(id, accelerator)
      }
    }
    return userKeybindings
  }

  change (id, accelerator) {
    const entry = this.keybindingList.find(entry => entry.id === id)
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

  unbind (id) {
    return this.change(id, '')
  }

  resetToDefault (id) {
    const accelerator = this.defaultKeybindings.get(id)
    if (accelerator == null) { // allow empty string
      return false
    }
    return this.change(id, accelerator)
  }

  async resetAll () {
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

  getDefaultAccelerator (id) {
    return this.defaultKeybindings.get(id)
  }

  _isDuplicate (accelerator) {
    return accelerator !== '' && this.keybindingList.findIndex(entry => isEqualAccelerator(entry.accelerator, accelerator)) !== -1
  }

  _isDefaultBinding (id, accelerator) {
    return this.defaultKeybindings.get(id) === accelerator
  }
}
