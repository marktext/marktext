<template>
  <div class="command-palette">
    <el-dialog
      :visible.sync="showCommandPalette"
      :show-close="false"
      :modal="true"
      @close="handleDialogClose"
      custom-class="ag-dialog-table"
      width="500px"
    >
      <div slot="title" class="search-wrapper">
        <div class="input-wrapper">
          <input
            ref="search"
            type="text"
            v-model="query"
            class="search"
            @keydown="handleBeforeInput"
            @keyup="handleInput"
            :placeholder="placeholderText"
          >
        </div>
        <loading v-if="searcherBusy"></loading>
        <transition name="fade" v-else-if="availableCommands.length">
          <ul class="commands">
            <li
              v-for="(item, index) of availableCommands"
              :key="index"
              ref="command-items"
              @click="search(item.id)"
              :class="{'active': index === selectedCommandIndex}"
            >
              <span class="title" :title="item.title">{{item.description}}</span>
              <span class="shortcut">
                <span
                  class="shortcut"
                  v-for="(accelerator, index) of item.shortcut"
                  :key="index"
                >
                    <kbd>{{accelerator}}</kbd>
                </span>
              </span>
            </li>
          </ul>
        </transition>
      </div>
    </el-dialog>
  </div>
</template>

<script>
import { mapState } from 'vuex'
import log from 'electron-log'
import bus from '../../bus'
import loading from '../loading'

export default {
  components: {
    loading
  },
  computed: {
    ...mapState({
      rootCommand: state => state.commandCenter.rootCommand
    })
  },
  data () {
    this.currentCommand = null
    this.defaultPlaceholderText = 'Type a command to execute'
    return {
      showCommandPalette: false,
      placeholderText: this.defaultPlaceholderText,
      query: '',
      selectedCommandIndex: -1,
      availableCommands: [],
      searcherBusy: false
    }
  },
  created () {
    this.$nextTick(() => {
      bus.$on('show-command-palette', this.handleShow)
    })
  },
  beforeDestroy () {
    bus.$off('show-command-palette', this.handleShow)
  },
  methods: {
    handleShow (command) {
      this.currentCommand = command || this.rootCommand
      this.currentCommand.run()
        .then(() => {
          this.availableCommands = this.currentCommand.subcommands
          this.selectedCommandIndex = this.currentCommand.subcommandSelectedIndex
          this.placeholderText = this.currentCommand.placeholder || this.defaultPlaceholderText
          this.query = ''
          this.showCommandPalette = true
          bus.$emit('editor-blur')
          this.$nextTick(() => {
            // Scroll selected entry into view.
            const items = this.$refs['command-items']
            const { selectedCommandIndex } = this
            if (items && items.length > 0 && selectedCommandIndex >= 0) {
              this.$refs['command-items'][selectedCommandIndex].scrollIntoView({ block: 'end' })
            }

            if (this.$refs.search) {
              this.$refs.search.focus()
            }
          })
        })
        .catch(error => {
          // Allow to throw new Error(null) to indicate an invalid state.
          if (error && error.message) {
            log.error('Unable to initialize command:', error)
          }
        })
    },
    handleDialogClose () {
      // Reset all settings
      this.selectedCommandIndex = -1
      this.query = ''
      this.availableCommands = []
      if (this.currentCommand.unload) {
        this.currentCommand.unload()
      }
      this.currentCommand = null
    },
    handleBeforeInput (event) {
      const { availableCommands, selectedCommandIndex } = this
      switch (event.key) {
        case 'ArrowUp': {
          event.preventDefault()
          event.stopPropagation()
          if (selectedCommandIndex <= 0) {
            this.selectedCommandIndex = availableCommands.length - 1
          } else {
            this.selectedCommandIndex--
          }

          const items = this.$refs['command-items']
          if (items && items.length > 0) {
            this.$refs['command-items'][this.selectedCommandIndex].scrollIntoView({ block: 'end' })
          }
          break
        }
        case 'ArrowDown': {
          event.preventDefault()
          event.stopPropagation()
          if (selectedCommandIndex + 1 >= availableCommands.length) {
            this.selectedCommandIndex = 0
          } else {
            this.selectedCommandIndex++
          }

          const items = this.$refs['command-items']
          if (items && items.length > 0) {
            this.$refs['command-items'][this.selectedCommandIndex].scrollIntoView({ block: 'end' })
          }
          break
        }
      }
    },
    handleInput (event) {
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
          this.search()
          break
        }
        default: {
          this.updateCommands()
          break
        }
      }
    },
    search (commandId = null) {
      const { availableCommands, selectedCommandIndex } = this
      if (commandId) {
        // Command selected from dropdown.
        this.executeCommand(commandId)
        return
      } else if (selectedCommandIndex >= 0 && selectedCommandIndex < availableCommands.length) {
        // Pressed enter on selected command.
        this.executeCommand(availableCommands[selectedCommandIndex].id)
        return
      }

      // Otherwise update list
      this.updateCommands()
    },
    updateCommands () {
      const { currentCommand, query } = this
      const queryString = query.trim()

      // Allow to handle search result by command (e.g. quick search).
      if (currentCommand.search) {
        this.searcherBusy = true
        currentCommand.search(queryString)
          .then(result => {
            this.searcherBusy = false
            this.availableCommands = result || []
            this.selectedCommandIndex = this.availableCommands.length ? 0 : -1
          })
          .catch(error => {
            // The query was cancel or restarted if `message` is null.
            if (error && error.message) {
              this.searcherBusy = false
              this.availableCommands = []
              this.selectedCommandIndex = -1
              log.error(error)
            }
          })
        return
      }

      // Default handler
      if (!queryString) {
        this.availableCommands = currentCommand.subcommands
      } else {
        this.availableCommands = currentCommand.subcommands
          .filter(c => c.description.toLowerCase().indexOf(queryString.toLowerCase()) !== -1)
      }
      this.selectedCommandIndex = this.availableCommands.length ? 0 : -1
    },
    executeCommand (commandId) {
      const { availableCommands, currentCommand } = this
      const command = availableCommands.find(c => c.id === commandId)
      if (!command) {
        log.error(`Cannot find command "${commandId}".`)
        return
      }

      const { executeSubcommand } = currentCommand
      if (executeSubcommand) {
        this.showCommandPalette = false
        executeSubcommand(commandId, command.value)
      } else {
        const { execute, subcommands, run } = command

        // Allow to load static commands without reloading command palette.
        if (execute === undefined && run === undefined && subcommands) {
          // Load subcommands
          this.currentCommand = command
          // NOTE: selected index is always -1 by static state loaded this way.
          this.selectedCommandIndex = -1
          this.query = ''
          this.updateCommands()
        } else {
          this.showCommandPalette = false
          execute()
        }
      }
    }
  }
}
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
    & > kbd {
      margin-left: 2px;
    }
  }

  .fade-enter-active, .fade-leave-active {
    transition: opacity .2s;
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
