<template>
  <aside
    v-if="ai.visible"
    class="ai-panel"
    :style="{ width: `${ai.width}px` }"
    :aria-busy="ai.loading"
  >
    <div
      class="ai-resize-handle"
      @pointerdown="startResize"
    />
    <header class="ai-header">
      <div>
        <strong>{{ labels.title }}</strong>
        <span class="ai-subtitle">{{ modeLabel }}</span>
      </div>
      <div class="ai-header-actions">
        <button
          class="icon-button"
          :title="labels.settings"
          @click="openSettings"
        >
          ⚙
        </button>
        <button
          class="icon-button"
          :title="labels.close"
          @click="ai.setVisible(false)"
        >
          ×
        </button>
      </div>
    </header>

    <div
      class="ai-mode-switch"
      role="tablist"
    >
      <button
        :class="{ active: ai.mode === 'answer' }"
        @click="ai.setMode('answer')"
      >
        {{ labels.answer }}
      </button>
      <button
        :class="{ active: ai.mode === 'edit' }"
        @click="ai.setMode('edit')"
      >
        {{ labels.edit }}
      </button>
    </div>

    <p class="ai-mode-help">
      {{ ai.mode === 'answer' ? labels.answerHelp : labels.editHelp }}
    </p>

    <div class="ai-messages">
      <div
        v-if="!ai.messages.length"
        class="ai-empty"
      >
        {{ labels.empty }}
      </div>
      <article
        v-for="message in ai.messages"
        :key="message.id"
        class="ai-message"
        :class="message.role"
      >
        <div class="ai-message-role">
          {{ message.role === 'user' ? labels.you : labels.ai }}
        </div>
        <pre>{{ message.content }}</pre>
      </article>
    </div>

    <div
      v-if="ai.error"
      class="ai-error"
    >
      {{ ai.error }}
    </div>

    <div
      v-if="ai.loading"
      class="ai-working"
      role="status"
      aria-live="polite"
    >
      <span
        class="ai-spinner"
        aria-hidden="true"
      />
      <span>{{ labels.working }}</span>
    </div>

    <div class="ai-composer">
      <textarea
        v-model="draft"
        :placeholder="labels.placeholder"
        :disabled="ai.loading || !hasDocument"
        rows="4"
      />
      <div class="ai-composer-actions">
        <span class="ai-hint">{{ labels.sendHint }}</span>
        <button
          v-if="ai.loading"
          class="secondary-button"
          @click="ai.stop"
        >
          {{ labels.stop }}
        </button>
        <button
          class="primary-button"
          :disabled="!draft.trim() || ai.loading || !hasDocument"
          @click="send"
        >
          {{ ai.loading ? labels.thinking : labels.send }}
        </button>
      </div>
    </div>

    <footer class="ai-footer">
      <button
        class="link-button"
        :disabled="!ai.messages.length"
        @click="ai.clearChat"
      >
        {{ labels.clear }}
      </button>
      <button
        class="link-button"
        @click="ai.undoAiEdit"
      >
        {{ labels.undo }}
      </button>
      <span
        v-if="!ai.settings.hasApiKey"
        class="ai-unconfigured"
      >
        {{ labels.unconfigured }}
      </span>
    </footer>
  </aside>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useAiStore } from '@/store/ai'
import { getCurrentLanguage } from '@/i18n'

const ai = useAiStore()
const { currentDocumentId } = storeToRefs(ai)
const draft = ref('')
const resizing = ref(false)
const resizeStartX = ref(0)
const resizeStartWidth = ref(380)

const chinese = computed(() => getCurrentLanguage().toLowerCase().startsWith('zh'))
const labels = computed(() => chinese.value
  ? {
      title: 'AI 编辑器',
      settings: 'AI 设置',
      close: '关闭',
      answer: '回答',
      edit: '修改文档',
      answerHelp: '回答模式只提供建议，不会修改当前文档。',
      editHelp: '修改模式会自动应用完整 Markdown，可用 AI 撤销恢复。',
      empty: '在这里开始与当前文档对话。',
      you: '你',
      ai: 'AI',
      placeholder: '输入问题或编辑指令…',
      sendHint: '点击发送按钮提交',
      working: 'AI 正在处理…',
      stop: '停止',
      thinking: '处理中…',
      send: '发送',
      clear: '清空对话',
      undo: '撤销 AI 修改',
      unconfigured: '未配置连接'
    }
  : {
      title: 'AI Editor',
      settings: 'AI settings',
      close: 'Close',
      answer: 'Answer',
      edit: 'Edit document',
      answerHelp: 'Answer mode provides suggestions only and never changes the document.',
      editHelp: 'Edit mode automatically applies complete Markdown and supports AI undo.',
      empty: 'Start a conversation about the current document.',
      you: 'You',
      ai: 'AI',
      placeholder: 'Ask a question or describe an edit…',
      sendHint: 'Click Send to submit',
      working: 'AI is working…',
      stop: 'Stop',
      thinking: 'Working…',
      send: 'Send',
      clear: 'Clear chat',
      undo: 'Undo AI edit',
      unconfigured: 'Connection not configured'
    })
const modeLabel = computed(() => ai.mode === 'answer' ? labels.value.answer : labels.value.edit)
const hasDocument = computed(() => !!currentDocumentId.value)

const send = (): void => {
  const value = draft.value.trim()
  if (!value) return
  draft.value = ''
  ai.submit(value).catch(() => undefined)
}

const openSettings = (): void => {
  window.electron.ipcRenderer.send('mt::open-setting-window', 'ai')
}

const startResize = (event: PointerEvent): void => {
  resizing.value = true
  resizeStartX.value = event.clientX
  resizeStartWidth.value = ai.width
  window.addEventListener('pointermove', resize)
  window.addEventListener('pointerup', stopResize, { once: true })
}

const resize = (event: PointerEvent): void => {
  if (!resizing.value) return
  ai.setWidth(resizeStartWidth.value - (event.clientX - resizeStartX.value))
}

const stopResize = (): void => {
  resizing.value = false
  window.removeEventListener('pointermove', resize)
}

onMounted(() => {
  ai.loadSettings().catch(() => undefined)
  ai.loadChat().catch(() => undefined)
  window.electron.ipcRenderer.on('mt::ai-settings-changed', (_event, value) => {
    ai.settings = value
  })
  window.electron.ipcRenderer.on('mt::ai-toggle-panel', ai.togglePanel)
})

watch(currentDocumentId, (value) => {
  if (value) ai.loadChat(value).catch(() => undefined)
})

onUnmounted(() => {
  window.electron.ipcRenderer.removeAllListeners('mt::ai-toggle-panel')
  window.electron.ipcRenderer.removeAllListeners('mt::ai-settings-changed')
  stopResize()
})
</script>

<style scoped>
.ai-panel {
  position: relative;
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  height: 100vh;
  box-sizing: border-box;
  border-left: 1px solid var(--floatBorderColor);
  background: var(--floatBgColor);
  color: var(--editorColor);
  z-index: 8;
}
.ai-resize-handle {
  position: absolute;
  left: -3px;
  top: 0;
  bottom: 0;
  width: 6px;
  cursor: ew-resize;
  z-index: 2;
}
.ai-header, .ai-footer, .ai-composer-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.ai-header { padding: 16px; border-bottom: 1px solid var(--floatBorderColor); }
.ai-subtitle { display: block; margin-top: 3px; color: var(--editorColor60); font-size: 12px; }
.ai-header-actions { display: flex; gap: 4px; }
.icon-button, .link-button, .primary-button, .secondary-button, .ai-mode-switch button {
  border: 0; cursor: pointer; font: inherit;
}
.icon-button { width: 28px; height: 28px; background: transparent; color: var(--editorColor); font-size: 18px; }
.ai-mode-switch { display: flex; gap: 4px; padding: 12px 12px 0; }
.ai-mode-switch button { flex: 1; padding: 8px; border-radius: 5px; color: var(--editorColor80); background: var(--sideBarItemHoverBgColor); }
.ai-mode-switch button.active { color: var(--highlightThemeColor); background: var(--floatHoverColor); font-weight: 600; }
.ai-mode-help { margin: 8px 14px; color: var(--editorColor60); font-size: 12px; line-height: 1.4; }
.ai-messages { flex: 1; overflow: auto; padding: 0 12px 12px; }
.ai-empty { padding: 30px 8px; color: var(--editorColor60); text-align: center; font-size: 13px; }
.ai-message { margin: 10px 0; padding: 9px 10px; border-radius: 7px; background: var(--editorBgColor); }
.ai-message.user { background: var(--floatHoverColor); }
.ai-message-role { margin-bottom: 5px; color: var(--editorColor60); font-size: 11px; font-weight: 600; }
.ai-message pre { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; font: inherit; line-height: 1.45; }
.ai-error { margin: 0 12px 8px; padding: 8px; color: var(--errorColor, #d33); border: 1px solid currentColor; border-radius: 5px; font-size: 12px; }
.ai-working { display: flex; align-items: center; gap: 7px; margin: 0 12px 8px; padding: 7px 8px; color: var(--editorColor60); background: var(--floatHoverColor); border-radius: 5px; font-size: 12px; }
.ai-spinner { width: 12px; height: 12px; box-sizing: border-box; border: 2px solid var(--editorColor30); border-top-color: var(--highlightThemeColor); border-radius: 50%; animation: ai-spinner-rotation .8s linear infinite; }
@keyframes ai-spinner-rotation { to { transform: rotate(360deg); } }
.ai-composer { padding: 10px 12px; border-top: 1px solid var(--floatBorderColor); }
.ai-composer textarea { width: 100%; box-sizing: border-box; resize: vertical; min-height: 76px; padding: 9px; border: 1px solid var(--floatBorderColor); border-radius: 5px; background: var(--editorBgColor); color: var(--editorColor); font: inherit; }
.ai-composer-actions { margin-top: 7px; gap: 8px; }
.ai-hint { flex: 1; color: var(--editorColor50); font-size: 11px; }
.primary-button, .secondary-button { padding: 6px 10px; border-radius: 4px; }
.primary-button { color: #fff; background: var(--highlightThemeColor); }
.secondary-button { color: var(--editorColor); background: var(--floatHoverColor); }
button:disabled { cursor: default; opacity: .45; }
.ai-footer { padding: 8px 12px 12px; gap: 10px; border-top: 1px solid var(--floatBorderColor); }
.link-button { padding: 0; color: var(--highlightThemeColor); background: transparent; font-size: 12px; }
.ai-unconfigured { margin-left: auto; color: var(--editorColor50); font-size: 11px; }
</style>
