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
      <button
        :class="{ active: ai.mode === 'rewrite' }"
        @click="ai.setMode('rewrite')"
      >
        {{ labels.rewrite }}
      </button>
    </div>

    <p class="ai-mode-help">
      {{ modeHelp }}
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
        <div
          v-if="message.content"
          class="ai-message-content"
        >
          {{ message.content }}
        </div>
        <div
          v-if="message.attachments?.length"
          class="ai-message-attachments"
        >
          <div
            v-for="attachment in message.attachments"
            :key="attachment.id"
            class="ai-image-preview"
          >
            <img
              v-if="attachmentUrl(attachment)"
              :src="attachmentUrl(attachment)"
              :alt="attachment.name"
            >
            <span>{{ attachment.name }}</span>
          </div>
        </div>
        <div
          v-if="message.editSummary || message.mode === 'rewrite'"
          class="ai-edit-summary"
        >
          {{ editSummaryLabel(message) }}
        </div>
      </article>
    </div>

    <div
      v-if="ai.error"
      class="ai-error"
    >
      {{ ai.error }}
    </div>

    <div
      v-if="ai.pendingRecovery"
      class="ai-recovery"
    >
      <p>{{ labels.recoveryWarning }}</p>
      <pre>{{ recoveryPreview }}</pre>
      <div class="ai-recovery-actions">
        <button
          class="primary-button"
          @click="ai.acceptPendingRecovery"
        >
          {{ labels.recoveryApply }}
        </button>
        <button
          class="secondary-button"
          @click="ai.discardPendingRecovery"
        >
          {{ labels.recoveryDiscard }}
        </button>
      </div>
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

    <div
      class="ai-composer"
      @dragenter.prevent="dragOver = true"
      @dragover.prevent="dragOver = true"
      @dragleave="dragOver = false"
      @drop.prevent="dropFiles"
    >
      <input
        ref="fileInput"
        class="ai-file-input"
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        multiple
        @change="selectFiles"
      >
      <div
        class="ai-attachment-dropzone"
        :class="{ active: dragOver }"
        @click="openFilePicker"
      >
        <span>📎 {{ labels.attachHint }}</span>
      </div>
      <p class="ai-attachment-privacy">
        {{ labels.attachmentPrivacy }}
      </p>
      <div
        v-if="ai.pendingAttachments.length"
        class="ai-pending-attachments"
      >
        <div
          v-for="pending in ai.pendingAttachments"
          :key="pending.attachment.id"
          class="ai-pending-attachment"
        >
          <img
            :src="pending.previewUrl"
            :alt="pending.attachment.name"
          >
          <span>{{ pending.attachment.name }}</span>
          <button
            type="button"
            :title="labels.removeAttachment"
            @click="ai.removePendingAttachment(pending.attachment.id)"
          >
            ×
          </button>
        </div>
      </div>
      <p
        v-if="attachmentErrorLabel"
        class="ai-attachment-error"
      >
        {{ attachmentErrorLabel }}
      </p>
      <textarea
        v-model="draft"
        :placeholder="labels.placeholder"
        :disabled="ai.loading || !hasDocument"
        rows="4"
        @paste="pasteFiles"
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
          :disabled="!draft.trim() || ai.loading || !!ai.pendingRecovery || !hasDocument"
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
import type { AiChatMessage, AiImageAttachment } from '@shared/types/ai'

const ai = useAiStore()
const { currentDocumentId } = storeToRefs(ai)
const draft = ref('')
const fileInput = ref<HTMLInputElement | null>(null)
const dragOver = ref(false)
const loadingPreviewIds = new Set<string>()
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
      editHelp: '精确修改只应用模型指出的局部内容，可用 AI 撤销恢复。',
      rewrite: '全文重写',
      rewriteHelp: '全文重写会替换整篇 Markdown，请确认后再使用。',
      empty: '在这里开始与当前文档对话。',
      you: '你',
      ai: 'AI',
      placeholder: '输入问题或编辑指令…',
      attachHint: '粘贴或拖入图片，也可点击选择',
      attachmentPrivacy: '图片会发送到当前配置的 AI 服务。',
      removeAttachment: '移除图片',
      attachmentUnsupported: '仅支持 PNG、JPEG、WebP 或 GIF 图片。',
      attachmentTooLarge: '单张图片不能超过 10 MB。',
      attachmentTooMany: '一次最多添加 10 张图片。',
      attachmentTotalTooLarge: '一次图片总大小不能超过 30 MB。',
      attachmentReadFailed: '无法读取图片。',
      sendHint: '点击发送按钮提交',
      working: 'AI 正在处理…',
      stop: '停止',
      thinking: '处理中…',
      send: '发送',
      clear: '清空对话',
      undo: '撤销 AI 修改',
      unconfigured: '未配置连接',
      editApplied: (count: number, added: number, removed: number) => `已应用 ${count} 处修改（新增 ${added} 行，删除 ${removed} 行）`,
      noChanges: '文档无需修改',
      rewriteApplied: '已重写全文',
      recoveryWarning: '模型未能生成可靠的局部编辑，以下是整篇替代结果，请确认差异后应用。',
      recoveryApply: '应用替代结果',
      recoveryDiscard: '丢弃'
    }
  : {
      title: 'AI Editor',
      settings: 'AI settings',
      close: 'Close',
      answer: 'Answer',
      edit: 'Edit document',
      answerHelp: 'Answer mode provides suggestions only and never changes the document.',
      editHelp: 'Precise edit applies only the requested local changes and supports AI undo.',
      rewrite: 'Rewrite document',
      rewriteHelp: 'Rewrite replaces the complete Markdown document. Use it intentionally.',
      empty: 'Start a conversation about the current document.',
      you: 'You',
      ai: 'AI',
      placeholder: 'Ask a question or describe an edit…',
      attachHint: 'Paste, drop, or choose images',
      attachmentPrivacy: 'Images are sent to the configured AI service.',
      removeAttachment: 'Remove image',
      attachmentUnsupported: 'Only PNG, JPEG, WebP, or GIF images are supported.',
      attachmentTooLarge: 'Each image must be smaller than 10 MB.',
      attachmentTooMany: 'You can attach up to 10 images at a time.',
      attachmentTotalTooLarge: 'Images in one request must total less than 30 MB.',
      attachmentReadFailed: 'The image could not be read.',
      sendHint: 'Click Send to submit',
      working: 'AI is working…',
      stop: 'Stop',
      thinking: 'Working…',
      send: 'Send',
      clear: 'Clear chat',
      undo: 'Undo AI edit',
      unconfigured: 'Connection not configured',
      editApplied: (count: number, added: number, removed: number) => `Applied ${count} edit${count === 1 ? '' : 's'} (+${added}/-${removed} lines)`,
      noChanges: 'No document changes were needed.',
      rewriteApplied: 'The document was rewritten.',
      recoveryWarning: 'The model could not produce a reliable local edit. Review the complete-document fallback before applying it.',
      recoveryApply: 'Apply fallback',
      recoveryDiscard: 'Discard'
    })
const modeLabel = computed(() => {
  if (ai.mode === 'rewrite') return labels.value.rewrite
  return ai.mode === 'answer' ? labels.value.answer : labels.value.edit
})
const modeHelp = computed(() => {
  if (ai.mode === 'rewrite') return labels.value.rewriteHelp
  return ai.mode === 'answer' ? labels.value.answerHelp : labels.value.editHelp
})
const hasDocument = computed(() => !!currentDocumentId.value)
const attachmentErrorLabel = computed(() => {
  if (ai.attachmentError === 'unsupported') return labels.value.attachmentUnsupported
  if (ai.attachmentError === 'too-large') return labels.value.attachmentTooLarge
  if (ai.attachmentError === 'too-many') return labels.value.attachmentTooMany
  if (ai.attachmentError === 'total-too-large') return labels.value.attachmentTotalTooLarge
  if (ai.attachmentError === 'read-failed') return labels.value.attachmentReadFailed
  return ''
})
const recoveryPreview = computed(() => {
  const proposal = ai.pendingRecovery
  if (!proposal) return ''
  return makeUnifiedDiff(proposal.beforeMarkdown, proposal.response.markdown ?? '')
})

const attachmentUrl = (attachment: AiImageAttachment): string => {
  const url = ai.attachmentPreviewUrls[attachment.id] ?? ''
  if (!url && !loadingPreviewIds.has(attachment.id)) {
    loadingPreviewIds.add(attachment.id)
    ai.loadAttachmentPreview(attachment).finally(() => loadingPreviewIds.delete(attachment.id))
  }
  return url
}

const editSummaryLabel = (message: AiChatMessage): string => {
  if (message.mode === 'rewrite') return labels.value.rewriteApplied
  if (!message.editSummary || message.editSummary.operationCount === 0) return labels.value.noChanges
  return labels.value.editApplied(
    message.editSummary.operationCount,
    message.editSummary.addedLines,
    message.editSummary.removedLines
  )
}

const send = (): void => {
  const value = draft.value.trim()
  if (!value) return
  draft.value = ''
  ai.submit(value).catch(() => undefined)
}

const makeUnifiedDiff = (before: string, after: string): string => {
  const oldLines = before.replaceAll('\r\n', '\n').split('\n')
  const newLines = after.replaceAll('\r\n', '\n').split('\n')
  const prefix = (() => {
    let index = 0
    while (index < oldLines.length && index < newLines.length && oldLines[index] === newLines[index]) index += 1
    return index
  })()
  let suffix = 0
  while (
    suffix < oldLines.length - prefix &&
    suffix < newLines.length - prefix &&
    oldLines[oldLines.length - suffix - 1] === newLines[newLines.length - suffix - 1]
  ) suffix += 1
  const oldChanged = oldLines.slice(prefix, oldLines.length - suffix)
  const newChanged = newLines.slice(prefix, newLines.length - suffix)
  const contextBefore = oldLines.slice(Math.max(0, prefix - 3), prefix).map(line => ` ${line}`)
  const contextAfter = oldLines.slice(oldLines.length - suffix, Math.min(oldLines.length, oldLines.length - suffix + 3)).map(line => ` ${line}`)
  const header = `@@ -${prefix + 1},${oldChanged.length} +${prefix + 1},${newChanged.length} @@`
  const body = [
    ...contextBefore,
    ...oldChanged.map(line => `-${line}`),
    ...newChanged.map(line => `+${line}`),
    ...contextAfter
  ]
  const result = [header, ...body].join('\n')
  return result.length > 12000 ? `${result.slice(0, 12000)}\n…` : result
}

const openFilePicker = (): void => {
  if (!ai.loading && hasDocument.value) fileInput.value?.click()
}

const addFiles = (files: File[]): void => {
  if (!files.length) return
  ai.addImageFiles(files).catch(() => undefined)
}

const selectFiles = (event: Event): void => {
  const input = event.target as HTMLInputElement
  addFiles(input.files ? Array.from(input.files) : [])
  input.value = ''
}

const dropFiles = (event: DragEvent): void => {
  dragOver.value = false
  if (event.dataTransfer) addFiles(Array.from(event.dataTransfer.files))
}

const pasteFiles = (event: ClipboardEvent): void => {
  const files: File[] = []
  if (event.clipboardData) {
    for (const item of Array.from(event.clipboardData.items)) {
      if (item.kind !== 'file') continue
      const file = item.getAsFile()
      if (file) files.push(file)
    }
  }
  if (files.length) {
    event.preventDefault()
    addFiles(files)
  }
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
  ai.discardPendingRecovery()
  ai.clearPendingAttachments()
  ai.releaseAllAttachmentPreviews()
  if (value) ai.loadChat(value).catch(() => undefined)
})

onUnmounted(() => {
  window.electron.ipcRenderer.removeAllListeners('mt::ai-toggle-panel')
  window.electron.ipcRenderer.removeAllListeners('mt::ai-settings-changed')
  ai.clearPendingAttachments()
  ai.releaseAllAttachmentPreviews()
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
  border-left: 1px solid var(--itemBgColor);
  background: var(--sideBarBgColor);
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
.ai-header { padding: 16px; border-bottom: 1px solid var(--itemBgColor); color: var(--sideBarTitleColor); }
.ai-subtitle { display: block; margin-top: 3px; color: var(--editorColor60); font-size: 12px; }
.ai-header-actions { display: flex; gap: 4px; }
.icon-button, .link-button, .primary-button, .secondary-button, .ai-mode-switch button {
  border: 0; cursor: pointer; font: inherit;
}
.icon-button { width: 28px; height: 28px; background: transparent; color: var(--sideBarIconColor); font-size: 18px; }
.icon-button:hover:not(:disabled), .link-button:hover:not(:disabled) { color: var(--themeColor); }
.ai-mode-switch { display: flex; gap: 4px; padding: 12px 12px 0; }
.ai-mode-switch button { flex: 1; padding: 8px; border: 1px solid transparent; border-radius: 5px; color: var(--sideBarColor); background: transparent; }
.ai-mode-switch button:hover:not(:disabled) { background: var(--sideBarItemHoverBgColor); }
.ai-mode-switch button.active { border-color: var(--themeColor); color: var(--themeColor); background: var(--buttonBgColorActive); font-weight: 600; }
.ai-mode-help { margin: 8px 14px; color: var(--editorColor60); font-size: 12px; line-height: 1.4; }
.ai-messages { flex: 1; overflow: auto; padding: 0 12px 12px; }
.ai-empty { padding: 30px 8px; color: var(--editorColor60); text-align: center; font-size: 13px; }
.ai-message { margin: 10px 0; padding: 9px 0; border-bottom: 1px solid var(--editorColor10); }
.ai-message.user { padding-left: 9px; border-left: 2px solid var(--themeColor); }
.ai-message-role { margin-bottom: 5px; color: var(--editorColor60); font-size: 11px; font-weight: 600; }
.ai-edit-summary { color: var(--editorColor80); font-size: 13px; line-height: 1.4; }
.ai-message-content { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; font: inherit; line-height: 1.45; }
.ai-message-attachments, .ai-pending-attachments { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 7px; }
.ai-image-preview, .ai-pending-attachment { display: flex; align-items: center; gap: 5px; max-width: 100%; padding: 3px 5px; border: 1px solid var(--editorColor20); border-radius: 4px; color: var(--editorColor70); font-size: 11px; overflow: hidden; }
.ai-image-preview img, .ai-pending-attachment img { width: 48px; height: 48px; flex: 0 0 auto; object-fit: cover; border-radius: 3px; background: var(--editorColor10); }
.ai-image-preview span, .ai-pending-attachment span { max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ai-pending-attachment button { padding: 0 2px; border: 0; color: var(--editorColor60); background: transparent; cursor: pointer; font: inherit; }
.ai-pending-attachment button:hover { color: var(--errorColor, #d33); }
  .ai-error { margin: 0 12px 8px; padding: 8px; color: var(--errorColor, #d33); border: 1px solid currentColor; border-radius: 5px; font-size: 12px; }
  .ai-recovery { margin: 0 12px 8px; padding: 8px; border: 1px solid var(--themeColor); border-radius: 5px; font-size: 12px; }
  .ai-recovery p { margin: 0 0 7px; line-height: 1.4; }
  .ai-recovery pre { max-height: 220px; margin: 0 0 7px; padding: 6px; overflow: auto; color: var(--editorColor); background: var(--editorColor10); font: 11px/1.35 monospace; white-space: pre-wrap; }
  .ai-recovery-actions { display: flex; gap: 7px; }
.ai-attachment-error { margin: 6px 0 0; color: var(--errorColor, #d33); font-size: 11px; }
.ai-working { display: flex; align-items: center; gap: 7px; margin: 0 12px 8px; padding: 7px 8px; color: var(--editorColor60); background: var(--floatHoverColor); border-radius: 5px; font-size: 12px; }
.ai-spinner { width: 12px; height: 12px; box-sizing: border-box; border: 2px solid var(--editorColor30); border-top-color: var(--themeColor); border-radius: 50%; animation: ai-spinner-rotation .8s linear infinite; }
@keyframes ai-spinner-rotation { to { transform: rotate(360deg); } }
.ai-composer { padding: 10px 12px; border-top: 1px solid var(--itemBgColor); }
.ai-file-input { display: none; }
.ai-attachment-dropzone { margin-bottom: 7px; padding: 6px 8px; border: 1px dashed var(--editorColor30); border-radius: 4px; color: var(--editorColor60); cursor: pointer; font-size: 11px; text-align: center; }
.ai-attachment-dropzone:hover, .ai-attachment-dropzone.active { border-color: var(--themeColor); color: var(--themeColor); background: var(--buttonBgColorActive); }
.ai-attachment-privacy { margin: -2px 0 6px; color: var(--editorColor50); font-size: 10px; }
.ai-composer textarea { width: 100%; box-sizing: border-box; resize: vertical; min-height: 76px; padding: 9px; border: 1px solid var(--editorColor30); border-radius: 5px; background: var(--inputBgColor); color: var(--editorColor); font: inherit; }
.ai-composer textarea:focus { outline: none; border-color: var(--themeColor); }
.ai-composer-actions { margin-top: 7px; gap: 8px; }
.ai-hint { flex: 1; color: var(--editorColor50); font-size: 11px; }
.primary-button, .secondary-button { padding: 6px 10px; border-radius: 4px; }
.primary-button { color: var(--buttonPrimaryFontColor); background: var(--buttonPrimaryBgColor); }
.primary-button:hover:not(:disabled) { background: var(--buttonPrimaryBgColorHover); }
.secondary-button { border: var(--buttonBorder); color: var(--buttonFontColor); background: var(--buttonBgColor); }
.secondary-button:hover:not(:disabled) { background: var(--buttonBgColorHover); }
button:disabled { cursor: default; opacity: .45; }
.ai-footer { padding: 8px 12px 12px; gap: 10px; border-top: 1px solid var(--itemBgColor); }
.link-button { padding: 0; color: var(--themeColor); background: transparent; font-size: 12px; }
.ai-unconfigured { margin-left: auto; color: var(--editorColor50); font-size: 11px; }
button:focus-visible, textarea:focus-visible { outline: 1px solid var(--themeColor); outline-offset: 1px; }
</style>
