<template>
  <div class="command-palette">
    <el-dialog
      v-model="showCommandPalette"
      :show-close="false"
      :modal="true"
      custom-class="ag-dialog-table"
      width="500px"
      @close="handleDialogClose"
    >
      <template #title>
        <div class="search-wrapper">
          <div class="input-wrapper">
            <input
              ref="searchInput"
              v-model="query"
              type="text"
              class="search"
              :placeholder="placeholderText"
              @keydown="handleBeforeInput"
              @keyup="handleInput"
            >
          </div>
          <loading v-if="searcherBusy" />
          <transition
            v-else
            name="fade"
          >
            <ul
              v-if="availableCommands.length"
              class="commands"
            >
              <li
                v-for="(item, index) of availableCommands"
                :key="index"
                :ref="
                  (el) => {
                    if (el) commandItems[index] = el
                  }
                "
                :class="{ active: index === selectedCommandIndex }"
                @click="search(item.id)"
              >
                <span
                  class="title"
                  :title="item.title"
                >{{ item.description }}</span>
                <span class="shortcut">
                  <span
                    v-for="(accelerator, idx) of item.shortcut"
                    :key="idx"
                    class="shortcut"
                  >
                    <kbd>{{ accelerator }}</kbd>
                  </span>
                </span>
              </li>
            </ul>
          </transition>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick, onBeforeUpdate, computed } from 'vue'
import { useCommandCenterStore } from '@/store/commandCenter'
import log from 'electron-log'
import bus from '../../bus'
import loading from '../loading'
import { useI18n } from 'vue-i18n'
const searchInput = ref(null)
let commandItems = []

const { t } = useI18n()
const currentCommand = ref(null)
const defaultPlaceholderText = computed(() => {
  try {
    return t('commandPalette.placeholder')
  } catch (error) {
    console.warn('i18n not ready, using fallback placeholder')
    return 'Search commands...'
  }
})

const showCommandPalette = ref(false)
const placeholderText = ref('')
const query = ref('')
const selectedCommandIndex = ref(-1)
const availableCommands = ref([])
const searcherBusy = ref(false)

const commandCenterStore = useCommandCenterStore()

onBeforeUpdate(() => {
  commandItems = []
})

const handleShow = (command) => {
  currentCommand.value = command || commandCenterStore.rootCommand
  currentCommand.value
    .run()
    .then(() => {
      availableCommands.value = currentCommand.value.subcommands
      selectedCommandIndex.value = currentCommand.value.subcommandSelectedIndex
      placeholderText.value = currentCommand.value.placeholder || defaultPlaceholderText.value
      query.value = ''
      showCommandPalette.value = true
      bus.emit('editor-blur')
      nextTick(() => {
        // Scroll selected entry into view.
        const items = commandItems
        const selIndex = selectedCommandIndex.value
        if (items && items.length > 0 && selIndex >= 0 && items[selIndex]) {
          items[selIndex].scrollIntoView({ block: 'end' })
        }

        if (searchInput.value) {
          setTimeout(() => {
            searchInput.value.focus()
          }, 50)
        }
      })
    })
    .catch((error) => {
      // Allow to throw new Error(null) to indicate an invalid state.
      if (error && error.message) {
        log.error('Unable to initialize command:', error)
      }
    })
}

const handleDialogClose = () => {
  // Reset all settings
  selectedCommandIndex.value = -1
  query.value = ''
  availableCommands.value = []
  if (currentCommand.value.unload) {
    currentCommand.value.unload()
  }
  currentCommand.value = null
}

const handleBeforeInput = (event) => {
  const items = commandItems
  switch (event.key) {
    case 'ArrowUp': {
      event.preventDefault()
      event.stopPropagation()
      if (selectedCommandIndex.value <= 0) {
        selectedCommandIndex.value = availableCommands.value.length - 1
      } else {
        selectedCommandIndex.value--
      }

      if (items && items.length > 0 && items[selectedCommandIndex.value]) {
        items[selectedCommandIndex.value].scrollIntoView({ block: 'end' })
      }
      break
    }
    case 'ArrowDown': {
      event.preventDefault()
      event.stopPropagation()
      if (selectedCommandIndex.value + 1 >= availableCommands.value.length) {
        selectedCommandIndex.value = 0
      } else {
        selectedCommandIndex.value++
      }

      if (items && items.length > 0 && items[selectedCommandIndex.value]) {
        items[selectedCommandIndex.value].scrollIntoView({ block: 'end' })
      }
      break
    }
  }
}

const handleInput = (event) => {
  if (event.isComposing) {
    return
  }
  // NOTE: We're using keyup to catch "enter" key but `ctrlKey` etc doesn't work here.
  switch (event.key) {
    case 'Control':
    case 'Alt':
    case 'Meta':
    case 'Shift':
    case 'Escape':
    case 'PageDown':
    case 'PageUp':
    case 'ArrowUp':
    case 'ArrowDown':
    case 'ArrowLeft':
    case 'ArrowRight': {
      // No-op
      break
    }
    case 'Enter': {
      search()
      break
    }
    default: {
      updateCommands()
      break
    }
  }
}

const search = (commandId = null) => {
  if (commandId) {
    // Command selected from dropdown.
    executeCommand(commandId)
    return
  } else if (
    selectedCommandIndex.value >= 0 &&
    selectedCommandIndex.value < availableCommands.value.length
  ) {
    // Pressed enter on selected command.
    executeCommand(availableCommands.value[selectedCommandIndex.value].id)
    return
  }

  // Otherwise update list
  updateCommands()
}

const updateCommands = () => {
  const queryString = query.value.trim()

  // Allow to handle search result by command (e.g. quick search).
  if (currentCommand.value.search) {
    searcherBusy.value = true
    currentCommand.value
      .search(queryString)
      .then((result) => {
        searcherBusy.value = false
        availableCommands.value = result || []
        selectedCommandIndex.value = availableCommands.value.length ? 0 : -1
      })
      .catch((error) => {
        // The query was cancel or restarted if `message` is null.
        if (error && error.message) {
          searcherBusy.value = false
          availableCommands.value = []
          selectedCommandIndex.value = -1
          log.error(error)
        }
      })
    return
  }

  // Default handler
  if (!queryString) {
    availableCommands.value = currentCommand.value.subcommands
  } else {
    availableCommands.value = currentCommand.value.subcommands.filter(
      (c) => c.description.toLowerCase().indexOf(queryString.toLowerCase()) !== -1
    )
  }
  selectedCommandIndex.value = availableCommands.value.length ? 0 : -1
}

const executeCommand = (commandId) => {
  const command = availableCommands.value.find((c) => c.id === commandId)
  if (!command) {
    log.error(`Command not found: ${commandId}`)
    return
  }

  const { executeSubcommand } = currentCommand.value
  if (executeSubcommand) {
    showCommandPalette.value = false
    executeSubcommand(commandId, command.value)
  } else {
    const { execute, subcommands, run } = command

    // Allow to load static commands without reloading command palette.
    if (execute === undefined && run === undefined && subcommands) {
      // Load subcommands
      currentCommand.value = command
      // NOTE: selected index is always -1 by static state loaded this way.
      selectedCommandIndex.value = -1
      query.value = ''
      updateCommands()
    } else {
      showCommandPalette.value = false
      execute()
    }
  }
}

const handleLanguageChanged = () => {
  // If the command palette is currently open, reload commands
  if (showCommandPalette.value && currentCommand.value) {
    currentCommand.value.run().then(() => {
      availableCommands.value = currentCommand.value.subcommands
      updateCommands()
    })
  }
}

onMounted(() => {
  bus.on('show-command-palette', handleShow)

  // Listen for language change events and reload the command list
  bus.on('language-changed', handleLanguageChanged)
})

onBeforeUnmount(() => {
  bus.off('show-command-palette', handleShow)
  bus.off('language-changed', handleLanguageChanged)
})
</script>

<style scoped>
/* Hide scrollbar for this dialog */
::-webkit-scrollbar {
  display: none;
}

.search-wrapper {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 500px;
  height: auto;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  padding: 8px;
  margin: 0 auto;
  margin-top: 8px;
  box-sizing: border-box;
  color: var(--editorColor);
  background: var(--floatBgColor);
  border: 1px solid var(--floatBorderColor);
  border-radius: 4px;
  box-shadow: 0 3px 8px 3px var(--floatShadow);
  z-index: 10000;
}
.input-wrapper {
  display: block;
  width: 100%;
  border: 1px solid var(--inputBgColor);
  background: var(--inputBgColor);
  border-radius: 3px;
}
input.search {
  width: 100%;
  height: 30px;
  margin: 0 10px;
  font-size: 14px;
  color: var(--editorColor);
  background: transparent;
  outline: none;
  border: none;
}
.cpt-loading {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 50px;
  padding: 0;
  margin: 8px 0 0 0;
  box-sizing: border-box;
}
ul.commands {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-height: 300px;
  padding: 0;
  margin: 8px 0 0 0;
  box-sizing: border-box;
  list-style: none;
  overflow: hidden;
  overflow-y: scroll;
}
ul.commands li {
  position: relative;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  max-width: 100%;
  height: 35px;
  padding: 0 8px;
  font-size: 14px;
  line-height: 35px;
  text-overflow: ellipsis;
  cursor: pointer;
}
ul.commands li:hover {
  background: var(--floatHoverColor);
  opacity: 0.9;
}
ul.commands li.active {
  background: var(--floatHoverColor);
}
ul.commands li span {
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
}
ul.commands li span.shortcut {
  font-size: 12px;
  line-height: 20px;
}
ul.commands li span.shortcut > kbd {
  margin-left: 2px;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s;
}
.fade-enter, .fade-leave-to /* .fade-leave-active below version 2.1.8 */ {
  opacity: 0;
}
</style>
<style>
.command-palette .cpt-loading .loader {
  margin-top: 20px;
}

.command-palette .el-dialog,
.command-palette .el-dialog.ag-dialog-table {
  box-shadow: none !important;
  border: none !important;
  background: none !important;
}
.command-palette .el-dialog__header {
  margin-bottom: 20px;
  padding: 0 !important;
}
.command-palette .el-dialog__body {
  display: none !important;
}
</style>
