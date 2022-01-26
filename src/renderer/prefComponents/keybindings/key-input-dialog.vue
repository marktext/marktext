<template>
  <div class="key-input-dialog">
    <div v-if="showKeyInputDialog" class="input-overlay"></div>
    <el-dialog
      :visible.sync="showKeyInputDialog"
      :show-close="false"
      :modal="false"
      @close="cancelKeybinding"
      custom-class="ag-dialog-table"
      width="350px"
    >
      <div slot="title" class="key-input-wrapper">
        <div class="input-wrapper">
          <input
            tabindex="0"
            type="text"
            ref="intputTextbox"
            v-model="keybindingInputValue"
            class="input-textbox"
            @keydown="handleKeyDown"
            @keyup="handleKeyUp"
            :placeholder="placeholderText"
          >
        </div>
        <div class="footer">
          <div class="descriptions">Press Enter to continue or ESC to exit.</div>
          <div
            v-show="!isKeybindingValid"
            class="invalid-keybinding"
          >
            Current key combination cannot be bound!
          </div>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script>
import {
  isCompositionEvent,
  isValidElectronAccelerator,
  getAcceleratorFromKeyboardEvent
} from '@hfelix/electron-localshortcut'

export default {
  data () {
    this.needCommitOnClose = true
    this.currentKeybinding = null
    this.defaultPlaceholderText = 'Press a key combination'
    return {
      showKeyInputDialog: false,
      placeholderText: this.defaultPlaceholderText,
      isKeybindingValid: true,
      keybindingInputValue: ''
    }
  },

  props: {
    onCommit: Function,
    showWithId: {
      type: String,
      default: null
    }
  },

  watch: {
    showWithId: function (value, oldValue) {
      if (value !== oldValue) {
        if (value) {
          this.handleShow()
        } else {
          this.cancelKeybinding()
        }
      }
    }
  },

  methods: {
    handleShow () {
      this.needCommitOnClose = true
      this.showKeyInputDialog = true
      this.$nextTick(() => {
        this.$refs.intputTextbox.focus()
      })
    },
    handleDialogClose () {
      this.currentKeybinding = null
      this.isKeybindingValid = true
      this.keybindingInputValue = ''
      this.showKeyInputDialog = false
    },
    handleKeyDown (event) {
      event.preventDefault()
      event.stopPropagation()
      if (isCompositionEvent(event)) {
        // FIXME: You can still write in the textbox while composition.
        return
      } else if (this.isRawKeyCode(event, 'Escape')) {
        this.cancelKeybinding()
        return
      } else if (this.isRawKeyCode(event, 'Enter')) {
        this.saveKeybinding()
        return
      }

      const keybinding = getAcceleratorFromKeyboardEvent(event)
      this.currentKeybinding = keybinding
      // Verify whether the given key binding is valid for Electron.
      this.isKeybindingValid = keybinding.isValid && isValidElectronAccelerator(keybinding.accelerator)
      this.keybindingInputValue = keybinding.accelerator
    },
    handleKeyUp (event) {
      event.preventDefault()
      event.stopPropagation()
    },
    cancelKeybinding () {
      // Don't commit twice if the user clicks on the background.
      if (this.needCommitOnClose) {
        this.needCommitOnClose = false
        this.onCommit(null)
        this.handleDialogClose()
      }
    },
    saveKeybinding () {
      if (!this.currentKeybinding) {
        this.cancelKeybinding()
        return
      }

      const { accelerator, isValid } = this.currentKeybinding
      if (!isValid) {
        // TODO: Show shake animation on error text.
        return
      }

      this.needCommitOnClose = false
      this.onCommit(accelerator)
      this.handleDialogClose()
    },
    isRawKeyCode (event, keyCode) {
      const { code, ctrlKey, altKey, shiftKey, metaKey } = event
      return event && code === keyCode && !ctrlKey && !altKey && !shiftKey && !metaKey
    }
  }
}
</script>

<style scoped>
  ::-webkit-scrollbar {
    display: none;
  }

  .key-input-wrapper {
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
  input.input-textbox {
    width: 100%;
    height: 30px;
    margin: 0 10px;
    font-size: 14px;
    color: var(--editorColor);
    background: transparent;
    outline: none;
    border: none;
  }
  .footer {
    font-size: 13px;
    text-align: center;
    & .description {
      margin-top: 2px;
    }
    & .invalid-keybinding {
      font-weight: bold;
    }
  }

  .fade-enter-active, .fade-leave-active {
    transition: opacity .2s;
  }
  .fade-enter, .fade-leave-to /* .fade-leave-active below version 2.1.8 */ {
    opacity: 0;
  }

  .input-overlay {
    position: fixed;
    left: 0;
    top: 0;
    right: 0;
    bottom: 0;
    z-index: 100;
    display: flex;
    justify-content: center;
    align-items: center;
    font-size: 13px;
    color: var(--editorColor);
    background: rgba(0, 0, 0, 0.5);
  }
</style>
<style>
  .key-input-dialog .el-dialog,
  .key-input-dialog .el-dialog.ag-dialog-table {
    box-shadow: none !important;
    border: none !important;
    background: none !important;
  }
  .key-input-dialog .el-dialog__header {
    margin-bottom: 20px;
    padding: 0 !important;
  }
  .key-input-dialog .el-dialog__body {
    display: none !important;
  }
</style>
