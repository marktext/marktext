import { defineStore } from 'pinia'
import bus from '../bus'
import { usePreferencesStore } from './preferences'
import { debouncedSendBufferedState } from './bufferedState'

const normalizeSideBarWidth = (width) => {
  const numericWidth = Number(width)
  return Number.isFinite(numericWidth) ? Math.max(numericWidth, 220) : 280
}

const createBufferedLayoutState = (state) => {
  if (!state) return null

  return {
    rightColumn: state.rightColumn,
    showSideBar: !!state.showSideBar,
    showTabBar: !!state.showTabBar,
    sideBarWidth: normalizeSideBarWidth(state.sideBarWidth)
  }
}

const width = localStorage.getItem('side-bar-width')
const sideBarWidth = normalizeSideBarWidth(width)

export const useLayoutStore = defineStore('layout', {
  state: () => ({
    rightColumn: 'files',
    showSideBar: false,
    showTabBar: false,
    sideBarWidth
  }),
  actions: {
    SET_LAYOUT(layout, { scheduleBufferUpdate = true } = {}) {
      if (layout.showSideBar !== undefined) {
        const { windowId } = global.marktext.env
        window.electron.ipcRenderer.send('mt::update-sidebar-menu', windowId, !!layout.showSideBar)
        const preferencesStore = usePreferencesStore()
        preferencesStore.SET_SINGLE_PREFERENCE({
          type: 'sideBarVisibility',
          value: !!layout.showSideBar
        })
      }
      Object.assign(this, layout)
      if (scheduleBufferUpdate) {
        debouncedSendBufferedState()
      }
    },
    CREATE_BUFFERED_STATE() {
      return createBufferedLayoutState(this.$state)
    },
    RESTORE_BUFFERED_STATE(state) {
      const layout = createBufferedLayoutState(state)
      if (!layout) return

      this.SET_SIDE_BAR_WIDTH(layout.sideBarWidth, { scheduleBufferUpdate: false })
      this.SET_LAYOUT(
        {
          rightColumn: layout.rightColumn,
          showSideBar: layout.showSideBar,
          showTabBar: layout.showTabBar
        },
        { scheduleBufferUpdate: false }
      )
      this.DISPATCH_LAYOUT_MENU_ITEMS()
    },
    TOGGLE_LAYOUT_ENTRY(entryName) {
      this[entryName] = !this[entryName]
      if (entryName === 'showSideBar') {
        const preferencesStore = usePreferencesStore()
        preferencesStore.SET_SINGLE_PREFERENCE({
          type: 'sideBarVisibility',
          value: !!this.showSideBar
        })
      }
      debouncedSendBufferedState()
    },
    SET_SIDE_BAR_WIDTH(width, { scheduleBufferUpdate = true } = {}) {
      const normalizedWidth = normalizeSideBarWidth(width)
      localStorage.setItem('side-bar-width', normalizedWidth)
      this.sideBarWidth = normalizedWidth
      if (scheduleBufferUpdate) {
        debouncedSendBufferedState()
      }
    },
    LISTEN_FOR_LAYOUT() {
      window.electron.ipcRenderer.on('mt::set-view-layout', (e, layout) => {
        if (layout.rightColumn) {
          this.SET_LAYOUT({
            ...layout,
            rightColumn: layout.rightColumn === this.rightColumn ? '' : layout.rightColumn,
            showSideBar: true
          })
        } else {
          this.SET_LAYOUT(layout)
        }
        this.DISPATCH_LAYOUT_MENU_ITEMS()
      })

      window.electron.ipcRenderer.on('mt::toggle-view-layout-entry', (event, entryName) => {
        this.TOGGLE_LAYOUT_ENTRY(entryName)
        this.DISPATCH_LAYOUT_MENU_ITEMS()
      })

      bus.on('view:toggle-layout-entry', (entryName) => {
        this.TOGGLE_LAYOUT_ENTRY(entryName)
        const { windowId } = global.marktext.env
        window.electron.ipcRenderer.send('mt::view-layout-changed', windowId, {
          [entryName]: this[entryName]
        })
      })
    },

    DISPATCH_LAYOUT_MENU_ITEMS() {
      const { windowId } = global.marktext.env
      const { showTabBar, showSideBar } = this
      window.electron.ipcRenderer.send('mt::view-layout-changed', windowId, {
        showTabBar,
        showSideBar
      })
    },

    CHANGE_SIDE_BAR_WIDTH(width) {
      this.SET_SIDE_BAR_WIDTH(width)
    }
  }
})
