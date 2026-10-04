<template>
  <div
    class="mt-comments"
    @keydown="onThreadKey"
  >
    <p
      v-if="hintKey"
      class="hint"
    >
      {{ t(hintKey) }}
    </p>
    <template v-else-if="parseError">
      <header class="chead">
        <div class="file">
          {{ fileLabel }}
        </div>
      </header>
      <div class="read-card">
        <p class="path">
          {{ parseError.path }}
        </p>
        <p class="hint">
          {{ t('comments.readError') }}
        </p>
        <span class="tag tag-read">{{ t('comments.badgeRead') }}</span>
      </div>
    </template>
    <section
      v-else-if="draft"
      class="draft"
    >
      <p class="composer-title">
        {{ t('comments.newComment') }}
      </p>
      <blockquote class="quote">
        {{ draft.quote }}
      </blockquote>
      <textarea
        v-model="draft.text"
        class="composer"
        :placeholder="t('comments.firstReply')"
        @keydown="onDraftKey"
      />
      <div class="actions">
        <button
          type="button"
          class="primary"
          :disabled="!draft.text.trim()"
          :title="draft.text.trim() ? undefined : t('comments.needText')"
          @click="saveDraft"
        >
          {{ t('comments.save') }}
        </button>
        <button
          type="button"
          class="btn"
          @click="comments.cancelDraft()"
        >
          {{ t('comments.cancel') }}
        </button>
      </div>
      <p class="hint">
        {{ t('comments.saveHint') }}
      </p>
    </section>
    <ThreadView v-else-if="selected" />
    <template v-else>
      <header class="chead">
        <div class="file">
          {{ fileLabel }}
        </div>
        <div class="count">
          {{ t('comments.unresolvedCount', { n: unresolvedCount }) }}
        </div>
        <label class="switch">
          <input
            v-model="showClosed"
            type="checkbox"
          >
          <span>{{ t('comments.showClosed') }}</span>
        </label>
        <button
          type="button"
          class="primary"
          :disabled="sendBlocked"
          :title="sendTitle"
          @click="sendAll"
        >
          {{ t('comments.sendAllCount', { n: unresolvedCount }) }}
        </button>
        <p class="hint">
          {{ sendTitle || t('comments.sendShortcut') }}
        </p>
      </header>
      <div class="list">
        <ThreadCard
          v-for="item in anchored"
          :key="item.id"
          :thread="item"
          :selected="item.id === selectedThreadId"
          :orphaned="false"
          :missing-reply="missingReply.has(item.id)"
          :user-name="userName"
          @select="selectedThreadId = item.id"
        />
        <p
          v-if="orphans.length"
          class="group"
        >
          {{ t('comments.orphanGroup') }}
        </p>
        <ThreadCard
          v-for="item in orphans"
          :key="item.id"
          :thread="item"
          :selected="item.id === selectedThreadId"
          :orphaned="true"
          :missing-reply="missingReply.has(item.id)"
          :user-name="userName"
          @select="selectedThreadId = item.id"
        />
        <p
          v-if="threads.length === 0"
          class="empty-msg"
        >
          {{ t('comments.empty') }}
        </p>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { Thread } from '@shared/types/comments'
import { computed, nextTick, onMounted, onScopeDispose } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { sendCommentThreads, sendPending, sendReasonTitle, sendUnavailableReason } from '@/agent/sendThreads'
import bus from '@/bus'
import { useAgentStore } from '@/store/agent'
import { useCommentsStore } from '@/store/comments'
import { useEditorStore } from '@/store/editor'
import ThreadCard from './threadCard.vue'
import ThreadView from './threadView.vue'
import './comments.css'

const { t } = useI18n()

async function saveDraft (): Promise<void> {
  try {
    await comments.saveDraft()
  } catch {
    // A failed write leaves the draft so the reply is not discarded.
  }
}

function onDraftKey (event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault()
    comments.cancelDraft()
    return
  }
  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault()
    saveDraft().catch(() => undefined)
  }
}
const comments = useCommentsStore()
const {
  threads,
  resolved,
  showClosed,
  selectedThreadId,
  draft,
  parseError,
  hintKey,
  unresolvedCount,
  missingReply,
  availability
} = storeToRefs(comments)
const sendBlocked = computed(() =>
  sendPending.value || sendUnavailableReason() != null || unresolvedCount.value === 0
)
const sendTitle = computed(() => sendReasonTitle(sendUnavailableReason()))

const userName = computed(() => {
  const repo = useAgentStore().repoState
  return repo.kind === 'repo' ? repo.userName : ''
})

const fileLabel = computed(() => {
  const name = useEditorStore().currentFile?.filename
  if (name) return name
  if (availability.value.kind !== 'ready') return ''
  const file = availability.value.file
  const slash = file.lastIndexOf('/')
  return slash === -1 ? file : file.slice(slash + 1)
})

const passes = (item: Thread): boolean => showClosed.value || item.status === 'open'

const anchored = computed(() =>
  threads.value
    .filter((item) => passes(item) && resolved.value.get(item.id)?.status !== 'orphaned')
    .sort((a, b) => {
      const left = resolved.value.get(a.id)
      const right = resolved.value.get(b.id)
      const leftIndex = left?.status === 'anchored' ? left.index : Number.MAX_SAFE_INTEGER
      const rightIndex = right?.status === 'anchored' ? right.index : Number.MAX_SAFE_INTEGER
      if (leftIndex !== rightIndex) return leftIndex - rightIndex
      const leftStart = left?.status === 'anchored' ? left.start : 0
      const rightStart = right?.status === 'anchored' ? right.start : 0
      return leftStart - rightStart
    })
)

const orphans = computed(() =>
  threads.value.filter(
    (item) => passes(item) && resolved.value.get(item.id)?.status === 'orphaned'
  )
)

const selected = computed(() =>
  threads.value.some((item) => item.id === selectedThreadId.value)
)

const visibleIds = (): string[] => [...anchored.value, ...orphans.value].map((item) => item.id)

const focusThread = (id: string): void => {
  nextTick(() => {
    const card = document.querySelector(`[data-thread="${CSS.escape(id)}"]`)
    const pane = document.querySelector('.thread-pane')
    const target = card instanceof HTMLElement ? card : pane
    if (target instanceof HTMLElement) target.focus()
  }).catch(() => undefined)
}

const step = (direction: 1 | -1): void => {
  const ids = visibleIds()
  if (!ids.length) return
  const at = ids.indexOf(selectedThreadId.value ?? '')
  const next = at === -1
    ? (direction > 0 ? 0 : ids.length - 1)
    : (at + direction + ids.length) % ids.length
  const id = ids[next]
  if (!id) return
  selectedThreadId.value = id
  focusThread(id)
}

const onThreadKey = (event: KeyboardEvent): void => {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
  if (event.altKey || event.metaKey || event.ctrlKey) return
  const target = event.target
  if (target instanceof HTMLElement && target.closest('.confirm-back')) return
  if (
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLInputElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  ) {
    return
  }
  event.preventDefault()
  step(event.key === 'ArrowDown' ? 1 : -1)
}

const onNext = (): void => {
  step(1)
}

const onPrevious = (): void => {
  step(-1)
}

const sendAll = (): void => {
  sendCommentThreads('all').catch(() => undefined)
}

onMounted(() => {
  bus.on('agent:next-thread', onNext)
  bus.on('agent:previous-thread', onPrevious)
})

onScopeDispose(() => {
  bus.off('agent:next-thread', onNext)
  bus.off('agent:previous-thread', onPrevious)
})
</script>
