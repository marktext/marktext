<template>
  <div class="key-input-dialog">
    <div
      v-if="showKeyInputDialog"
      class="input-overlay"
    />
    <el-dialog
      v-model="showKeyInputDialog"
      :show-close="false"
      :modal="false"
      custom-class="ag-dialog-table"
      width="350px"
      @close="cancelKeybinding"
      @opened="handleFocusOnShow"
    >
      <template #title>
        <div class="key-input-wrapper">
          <div class="input-wrapper">
            <input
              ref="inputTextbox"
              v-model="keybindingInputValue"
              tabindex="0"
              type="text"
              class="input-textbox"
              :placeholder="placeholderText"
              @keydown="handleKeyDown"
              @keyup="handleKeyUp"
            >
          </div>
          <div class="footer">
            <div class="descriptions">
              {{ t('preferences.keybindings.keyInputDialog.instructions') }}
            </div>
            <div
              v-show="!isKeybindingValid"
              class="invalid-keybinding"
            >
              {{ t('preferences.keybindings.keyInputDialog.invalidKeybinding') }}
            </div>
          </div>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import {
  isCompositionEvent,
  isValidElectronAccelerator,
  getAcceleratorFromKeyboardEvent
} from '@hfelix/electron-localshortcut'
import { ref, watch, useTemplateRef, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps({
  onCommit: Function,
  showWithId: {
    type: String,
    default: null
  }
})

let needCommitOnClose = true
let currentKeybinding = null
const defaultPlaceholderText = t('preferences.keybindings.keyInputDialog.placeholder')

const showKeyInputDialog = ref(false)
const placeholderText = ref(defaultPlaceholderText)
const isKeybindingValid = ref(true)
const keybindingInputValue = ref('')
const inputTextbox = useTemplateRef('inputTextbox')

watch(
  () => props.showWithId,
  (value, oldValue) => {
    if (value !== oldValue) {
      if (value) {
        handleShow()
      } else {
        cancelKeybinding()
      }
    }
  }
)

const handleShow = () => {
  needCommitOnClose = true
  showKeyInputDialog.value = true
}

const handleFocusOnShow = () => {
  if (!inputTextbox.value) return
  nextTick(() => {
    inputTextbox.value.focus()
  })
}

const handleDialogClose = () => {
  currentKeybinding = null
  isKeybindingValid.value = true
  keybindingInputValue.value = ''
  showKeyInputDialog.value = false
}

const handleKeyDown = (event) => {
  event.preventDefault()
  event.stopPropagation()
  if (isCompositionEvent(event)) {
    // FIXME: You can still write in the textbox while composition.
    return
  } else if (isRawKeyCode(event, 'Escape')) {
    cancelKeybinding()
    return
  } else if (isRawKeyCode(event, 'Enter')) {
    saveKeybinding()
    return
  }

  const keybinding = getAcceleratorFromKeyboardEvent(event)
  currentKeybinding = keybinding
  // Verify whether the given key binding is valid for Electron.
  isKeybindingValid.value = keybinding.isValid && isValidElectronAccelerator(keybinding.accelerator)
  keybindingInputValue.value = keybinding.accelerator
}

const handleKeyUp = (event) => {
  event.preventDefault()
  event.stopPropagation()
}

const cancelKeybinding = () => {
  // Don't commit twice if the user clicks on the background.
  if (needCommitOnClose) {
    needCommitOnClose = false
    props.onCommit(null)
    handleDialogClose()
  }
}

const saveKeybinding = () => {
  if (!currentKeybinding) {
    cancelKeybinding()
    return
  }

  const { accelerator, isValid } = currentKeybinding
  if (!isValid) {
    // TODO: Show shake animation on error text.
    return
  }

  needCommitOnClose = false
  props.onCommit(accelerator)
  handleDialogClose()
}

const isRawKeyCode = (event, keyCode) => {
  const { code, ctrlKey, altKey, shiftKey, metaKey } = event
  return event && code === keyCode && !ctrlKey && !altKey && !shiftKey && !metaKey
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

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s;
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
