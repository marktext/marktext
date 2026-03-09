import path from 'path'
import fs from 'fs/promises'
import { createHash } from 'crypto'
import { execFileSync } from 'child_process'
import { BrowserWindow, dialog, ipcMain } from 'electron'
import log from 'electron-log'
import githubStyleMarkdownIcons from '../../common/githubStyleMarkdownIcons.json'

const FEATURE_DB_FILE_NAME = 'feature-config.sqlite'
const ICON_DRAWER_FLAG = 'icons.drawer.enabled'
const SUPPORTED_ICON_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.svg', '.webp', '.gif'])

const now = () => Date.now()

const sqlQuote = value => {
  if (value === null || typeof value === 'undefined') {
    return 'NULL'
  }
  return `'${String(value).replace(/'/g, "''")}'`
}

class FeatureConfig {
  constructor (paths) {
    const { userDataPath } = paths
    this.dbPath = path.join(userDataPath, FEATURE_DB_FILE_NAME)
    this.isAvailable = this._isSqliteAvailable()
    this._listenForIpcMain()

    if (!this.isAvailable) {
      log.warn('[feature-config] sqlite3 CLI not available. Icon drawer persistence is disabled.')
      return
    }

    this._init()
  }

  _isSqliteAvailable () {
    try {
      execFileSync('sqlite3', ['--version'], { encoding: 'utf8' })
      return true
    } catch (err) {
      return false
    }
  }

  _exec (sql) {
    if (!this.isAvailable) return ''
    return execFileSync('sqlite3', [this.dbPath, sql], { encoding: 'utf8' })
  }

  _query (sql) {
    if (!this.isAvailable) return []
    const output = execFileSync('sqlite3', ['-json', this.dbPath, sql], { encoding: 'utf8' }).trim()
    return output ? JSON.parse(output) : []
  }

  _init () {
    this._exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS feature_flags (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS icon_items (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        source TEXT NOT NULL CHECK(source IN ('custom', 'local')),
        icon_type TEXT NOT NULL CHECK(icon_type IN ('image_path')),
        value TEXT NOT NULL,
        meta_json TEXT NOT NULL DEFAULT '{}',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_icon_items_source ON icon_items(source);
    `)

    const enabled = this.getFeatureFlag(ICON_DRAWER_FLAG, true)
    this.setFeatureFlag(ICON_DRAWER_FLAG, enabled)
  }

  getFeatureFlag (key, fallback = null) {
    if (!this.isAvailable) return fallback
    const rows = this._query(`
      SELECT value
      FROM feature_flags
      WHERE key = ${sqlQuote(key)}
      LIMIT 1;
    `)
    if (!rows.length) return fallback
    try {
      return JSON.parse(rows[0].value)
    } catch (err) {
      return fallback
    }
  }

  setFeatureFlag (key, value) {
    if (!this.isAvailable) return value
    const valueJson = JSON.stringify(value)
    const timestamp = now()
    this._exec(`
      INSERT INTO feature_flags (key, value, updated_at)
      VALUES (${sqlQuote(key)}, ${sqlQuote(valueJson)}, ${timestamp})
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = excluded.updated_at;
    `)
    return value
  }

  listIcons () {
    const defaults = githubStyleMarkdownIcons.map(icon => {
      return Object.assign({}, icon, { createdAt: 0, updatedAt: 0 })
    })

    if (!this.isAvailable) return defaults
    const rows = this._query(`
      SELECT
        id,
        name,
        source,
        icon_type AS iconType,
        value,
        meta_json AS metaJson,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM icon_items
      ORDER BY updated_at DESC, created_at DESC;
    `)

    const customAndLocal = rows.map(row => {
      let meta = {}
      try {
        meta = JSON.parse(row.metaJson || '{}')
      } catch (err) {}
      return Object.assign(row, { meta })
    })

    return [...defaults, ...customAndLocal]
  }

  addCustomIcon ({ name, value }) {
    if (!this.isAvailable) return null
    if (!value || !String(value).trim()) {
      throw new Error('Icon value is required.')
    }

    const trimmedValue = String(value).trim()
    const fallbackName = trimmedValue.split(/[\\/]/).pop() || 'Custom Icon'
    const iconName = (name || fallbackName).trim()
    const timestamp = now()
    const id = `custom_${timestamp}_${Math.random().toString(36).slice(2, 8)}`
    const meta = JSON.stringify({ origin: 'manual' })

    this._exec(`
      INSERT INTO icon_items (id, name, source, icon_type, value, meta_json, created_at, updated_at)
      VALUES (
        ${sqlQuote(id)},
        ${sqlQuote(iconName)},
        'custom',
        'image_path',
        ${sqlQuote(trimmedValue)},
        ${sqlQuote(meta)},
        ${timestamp},
        ${timestamp}
      );
    `)

    return { id, name: iconName, source: 'custom', iconType: 'image_path', value: trimmedValue, meta: { origin: 'manual' }, createdAt: timestamp, updatedAt: timestamp }
  }

  removeIcon (id) {
    if (!this.isAvailable) return false
    if (!id) return false
    this._exec(`
      DELETE FROM icon_items
      WHERE id = ${sqlQuote(id)};
    `)
    return true
  }

  async importLocalIcons (directoryPath) {
    if (!this.isAvailable) return { imported: 0, directoryPath, skipped: 0 }

    const entries = await fs.readdir(directoryPath, { withFileTypes: true })
    const timestamp = now()
    let imported = 0
    let skipped = 0

    for (const entry of entries) {
      if (!entry.isFile()) {
        skipped++
        continue
      }

      const extension = path.extname(entry.name).toLowerCase()
      if (!SUPPORTED_ICON_EXTENSIONS.has(extension)) {
        skipped++
        continue
      }

      const fullPath = path.join(directoryPath, entry.name)
      const id = `local_${createHash('sha1').update(fullPath).digest('hex').slice(0, 16)}`
      const iconName = path.parse(entry.name).name
      const meta = JSON.stringify({ directoryPath })

      this._exec(`
        INSERT INTO icon_items (id, name, source, icon_type, value, meta_json, created_at, updated_at)
        VALUES (
          ${sqlQuote(id)},
          ${sqlQuote(iconName)},
          'local',
          'image_path',
          ${sqlQuote(fullPath)},
          ${sqlQuote(meta)},
          ${timestamp},
          ${timestamp}
        )
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          value = excluded.value,
          meta_json = excluded.meta_json,
          updated_at = excluded.updated_at;
      `)
      imported++
    }

    return { imported, skipped, directoryPath }
  }

  _listenForIpcMain () {
    ipcMain.handle('mt::icon-library-list', async () => {
      const drawerEnabled = this.getFeatureFlag(ICON_DRAWER_FLAG, true)
      const icons = this.listIcons()
      return { drawerEnabled, icons }
    })

    ipcMain.handle('mt::icon-library-set-enabled', async (event, enabled) => {
      const value = this.setFeatureFlag(ICON_DRAWER_FLAG, !!enabled)
      ipcMain.emit('broadcast-feature-config-changed', { icons: true, drawerEnabled: value })
      return value
    })

    ipcMain.handle('mt::icon-library-add-custom', async (event, payload = {}) => {
      const icon = this.addCustomIcon(payload)
      ipcMain.emit('broadcast-feature-config-changed', { icons: true })
      return icon
    })

    ipcMain.handle('mt::icon-library-remove', async (event, iconId) => {
      const result = this.removeIcon(iconId)
      ipcMain.emit('broadcast-feature-config-changed', { icons: true })
      return result
    })

    ipcMain.handle('mt::icon-library-import-local', async (event, directoryPath = '') => {
      let targetPath = directoryPath
      if (!targetPath) {
        const win = BrowserWindow.fromWebContents(event.sender)
        const { filePaths } = await dialog.showOpenDialog(win, {
          properties: ['openDirectory']
        })
        if (!filePaths || !filePaths[0]) {
          return { imported: 0, skipped: 0, cancelled: true }
        }
        targetPath = filePaths[0]
      }

      const result = await this.importLocalIcons(targetPath)
      ipcMain.emit('broadcast-feature-config-changed', { icons: true })
      return result
    })
  }
}

export default FeatureConfig
