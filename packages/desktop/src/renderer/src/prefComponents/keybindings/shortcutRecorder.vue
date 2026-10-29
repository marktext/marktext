<template>
  <div class="shortcut-recording">
    <input
      ref="input"
      class="shortcut-recorder"
      type="text"
      readonly
      :value="recorded"
      :aria-invalid="invalid"
      :aria-label="t('preferences.keybindings.editShortcut', { name: commandName })"
      :placeholder="t('preferences.keybindings.recorder.placeholder')"
      @keydown="record"
      @keyup.stop.prevent
      @blur="cancel(false)"
    >
    <span
      v-if="invalid"
      class="shortcut-record-error"
      role="alert"
    >{{ t('preferences.keybindings.recorder.invalidKeybinding') }}</span>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { getAcceleratorFromKeyboardEvent, isCompositionEvent, isValidElectronAccelerator } from 'common/localShortcut'
import { acceleratorToLabel } from '@/util/accelerator'
import { isMac } from '@/util'

defineProps<{ commandName: string }>()
const emit = defineEmits<{ commit: [accelerator: string]; cancel: [restoreFocus: boolean] }>()
const { t } = useI18n()
const input = useTemplateRef<HTMLInputElement>('input')
const recorded = ref('')
const invalid = ref(false)
let finished = false

onMounted(() => { input.value?.focus() })

const cancel = (restoreFocus: boolean): void => {
  if (finished) return
  finished = true
  emit('cancel', restoreFocus)
}
const record = (event: KeyboardEvent): void => {
  event.preventDefault()
  event.stopPropagation()
  if (finished || event.repeat || isCompositionEvent(event)) return
  const unmodified = !event.ctrlKey && !event.altKey && !event.metaKey && !event.shiftKey
  if (unmodified && event.code === 'Escape') {
    cancel(true)
    return
  }
  if (['Control', 'Alt', 'Shift', 'Meta'].includes(event.key)) return
  const result = getAcceleratorFromKeyboardEvent(event)
  recorded.value = acceleratorToLabel(result.accelerator, isMac)
  const valid = result.isValid && isValidElectronAccelerator(result.accelerator)
  invalid.value = !valid
  if (!valid) return
  finished = true
  emit('commit', result.accelerator)
}
</script>

<style scoped>
.shortcut-recording { position: relative; }
.shortcut-record-error {
  display: block;
  margin-top: 6px;
  color: var(--deleteColor);
  font-size: 12px;
  max-width: 160px;
}
.shortcut-recorder {
  box-sizing: border-box;
  width: 160px;
  max-width: 100%;
  height: 36px;
  padding: 6px 10px;
  border: 1px solid var(--themeColor);
  border-radius: 6px;
  background: transparent;
  color: var(--editorColor);
  outline: 1px solid var(--themeColor);
  font: inherit;
  text-align: right;
}
.shortcut-recorder::placeholder { color: var(--editorColor50); }
@container (max-width: 480px) {
  .shortcut-recorder { width: 120px; }
}
</style>
