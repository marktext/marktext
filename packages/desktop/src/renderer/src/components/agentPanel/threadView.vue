<template>
  <section
    v-if="thread"
    class="mt-comments thread-pane"
  >
    <header class="chead">
      <button
        type="button"
        class="back"
        @click="selectedThreadId = null"
      >
        {{ t('comments.allThreads') }}
      </button>
      <div class="file">
        {{ fileLabel }}
      </div>
      <div class="count">
        {{ t('comments.unresolvedCount', { n: unresolvedCount }) }}
      </div>
      <button
        type="button"
        class="btn"
        :disabled="sendBlocked"
        :title="sendTitle"
        @click="sendAll"
      >
        {{ t('comments.sendAllCount', { n: unresolvedCount }) }}
      </button>
    </header>
    <div class="thread-scroll">
      <blockquote class="quote">
        {{ thread.anchor.quote }}
      </blockquote>
      <button
        v-if="!orphaned"
        type="button"
        class="linkish"
        @click="showInText"
      >
        {{ t('comments.showInText') }}
      </button>
      <p
        v-else
        class="warn"
      >
        {{ t('comments.orphanWarn') }}
      </p>
      <span
        v-if="thread.status === 'closed'"
        class="tag tag-closed"
      >{{ t('comments.badgeClosed') }}</span>
      <article
        v-for="message in thread.messages"
        :key="message.id"
        class="msg"
        :data-id="message.id"
        :data-kind="message.author.kind"
      >
        <div class="msg-head">
          <span
            v-if="message.author.kind === 'agent'"
            class="harness"
            aria-hidden="true"
          >
            <svg viewBox="0 0 16 16">
              <circle
                cx="8"
                cy="8"
                r="6"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
              />
              <circle
                cx="8"
                cy="8"
                r="2"
                fill="currentColor"
              />
            </svg>
          </span>
          <div
            class="who"
            :class="{ agent: message.author.kind === 'agent' }"
          >
            {{ signature(message) }}
            <span class="when">
              {{ formatWhen(message.createdAt, locale, t('comments.justNow')) }}
              <span
                v-if="editedMark(message)"
                class="edited"
              > · {{ t('comments.edited') }}</span>
            </span>
          </div>
          <button
            v-if="message.author.kind === 'human'"
            type="button"
            class="kebab"
            :aria-label="t('comments.replyActions')"
            aria-haspopup="menu"
            :aria-expanded="menuId === message.id"
            @click="toggleMenu(message.id)"
          >
            <svg
              viewBox="0 0 14 14"
              aria-hidden="true"
            >
              <circle
                cx="7"
                cy="3"
                r="1.2"
                fill="currentColor"
              />
              <circle
                cx="7"
                cy="7"
                r="1.2"
                fill="currentColor"
              />
              <circle
                cx="7"
                cy="11"
                r="1.2"
                fill="currentColor"
              />
            </svg>
          </button>
        </div>
        <div
          v-if="menuId === message.id && message.author.kind === 'human'"
          class="menu"
          role="menu"
        >
          <button
            type="button"
            role="menuitem"
            @click="beginEdit(message)"
          >
            {{ t('comments.edit') }}
          </button>
          <button
            type="button"
            role="menuitem"
            :aria-disabled="message.id === lastHumanId"
            :title="message.id === lastHumanId ? t('comments.lastHuman') : undefined"
            @click="removeMessage(message.id)"
          >
            {{ t('comments.deleteMessage') }}
          </button>
        </div>
        <div
          v-if="editingId === message.id && message.author.kind === 'human'"
          class="edit"
        >
          <textarea
            v-model="editDraft"
            class="edit-area"
            rows="3"
          />
          <div class="edit-actions">
            <button
              type="button"
              class="btn"
              @click="saveEdit"
            >
              {{ t('comments.save') }}
            </button>
            <button
              type="button"
              class="btn"
              @click="editingId = null"
            >
              {{ t('comments.cancel') }}
            </button>
          </div>
        </div>
        <div
          v-else-if="message.author.kind === 'agent'"
          class="msg-body"
          :class="{ clamp: clamped(message.id, message.text) }"
        >
          <template
            v-for="(block, index) in agentBlocks(message.text)"
            :key="index"
          >
            <p v-if="block.kind === 'p'">
              {{ block.text }}
            </p>
            <ul v-else-if="block.kind === 'ul'">
              <li
                v-for="(item, itemIndex) in block.items"
                :key="itemIndex"
              >
                {{ item }}
              </li>
            </ul>
            <pre v-else>{{ block.text }}</pre>
          </template>
        </div>
        <button
          v-if="message.author.kind === 'agent' && longText(message.text)"
          type="button"
          class="linkish"
          @click="toggleExpanded(message.id)"
        >
          {{ expanded.has(message.id) ? t('comments.collapse') : t('comments.expand') }}
        </button>
        <div
          v-if="message.author.kind === 'human' && editingId !== message.id"
          class="msg-body plain"
        >
          {{ message.text }}
        </div>
      </article>
    </div>
    <footer class="thread-foot">
      <ReplyEditor :send="addReply" />
      <button
        type="button"
        class="primary"
        :disabled="sendOneBlocked"
        :title="sendOneTitle"
        @click="sendSelected"
      >
        {{ t('comments.send') }}
      </button>
      <div class="actions">
        <button
          type="button"
          class="btn"
          @click="toggleStatus"
        >
          {{ thread.status === 'open' ? t('comments.close') : t('comments.reopen') }}
        </button>
        <button
          type="button"
          class="btn"
          @click="confirming = true"
        >
          {{ t('comments.delete') }}
        </button>
      </div>
      <div
        v-if="turnInProgress"
        class="turn-row"
      >
        <p class="hint">
          {{ t('agent.turnWait') }}
        </p>
        <button
          type="button"
          class="textbtn"
          @click="cancelTurn"
        >
          {{ t('comments.cancelTurn') }}
        </button>
      </div>
    </footer>
    <div
      v-if="confirming"
      class="confirm-back"
    >
      <div
        class="confirm"
        role="dialog"
        aria-modal="true"
      >
        <p>{{ t('comments.confirmDelete') }}</p>
        <div class="actions">
          <button
            type="button"
            class="danger"
            @click="confirmDelete"
          >
            {{ t('comments.delete') }}
          </button>
          <button
            type="button"
            class="btn"
            @click="confirming = false"
          >
            {{ t('comments.cancel') }}
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { HumanMessage, Message } from '@shared/types/comments'
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { sendCommentThreads, sendPending, sendReasonTitle, sendUnavailableReason } from '@/agent/sendThreads'
import bus from '@/bus'
import { useAgentStore } from '@/store/agent'
import { useCommentsStore } from '@/store/comments'
import { useEditorStore } from '@/store/editor'
import ReplyEditor from './replyEditor.vue'
import { agentBlocks, formatWhen, harnessLabel, personName } from './commentsFormat'
import './comments.css'

const { t, locale } = useI18n()
const comments = useCommentsStore()
const { threads, resolved, selectedThreadId, unresolvedCount } = storeToRefs(comments)
const { turnInProgress } = storeToRefs(useAgentStore())

const menuId = ref<string | null>(null)
const editingId = ref<string | null>(null)
const editDraft = ref('')
const confirming = ref(false)
const expanded = ref(new Set<string>())

const thread = computed(() =>
  threads.value.find((item) => item.id === selectedThreadId.value) ?? null
)

const orphaned = computed(() => {
  const id = thread.value?.id
  if (!id) return false
  return resolved.value.get(id)?.status === 'orphaned'
})

const userName = computed(() => {
  const repo = useAgentStore().repoState
  return repo.kind === 'repo' ? repo.userName : ''
})

const fileLabel = computed(() => {
  const name = useEditorStore().currentFile?.filename
  if (name) return name
  const file = comments.availability.kind === 'ready' ? comments.availability.file : ''
  const slash = file.lastIndexOf('/')
  return slash === -1 ? file : file.slice(slash + 1)
})

const unavailable = computed(() => sendUnavailableReason())
const sendBlocked = computed(() =>
  sendPending.value || unavailable.value != null || unresolvedCount.value === 0
)
const sendTitle = computed(() => sendReasonTitle(unavailable.value))
const sendOneBlocked = computed(() =>
  sendPending.value || unavailable.value != null || thread.value?.status !== 'open'
)
const sendOneTitle = computed(() => {
  if (unavailable.value) return sendReasonTitle(unavailable.value)
  if (thread.value?.status === 'closed') return t('comments.sendOpenOnly')
  return undefined
})

const lastHumanId = computed(() => {
  const messages = thread.value?.messages ?? []
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i]
    if (message?.author.kind === 'human') return message.id
  }
  return null
})

const isHuman = (message: Message): message is HumanMessage =>
  message.author.kind === 'human'

const editedMark = (message: Message): boolean =>
  isHuman(message) && message.editedAt !== null

const signature = (message: Message): string => {
  if (message.author.kind === 'agent') {
    return `${harnessLabel(message.author.harness)} · ${message.author.model}`
  }
  return personName(message.author.name, userName.value)
}

const longText = (text: string): boolean => text.split('\n').length > 8 || text.length > 320

const clamped = (id: string, text: string): boolean => longText(text) && !expanded.value.has(id)

const toggleExpanded = (id: string): void => {
  const next = new Set(expanded.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expanded.value = next
}

const toggleMenu = (id: string): void => {
  menuId.value = menuId.value === id ? null : id
}

const beginEdit = (message: Message): void => {
  if (message.author.kind !== 'human') return
  menuId.value = null
  editingId.value = message.id
  editDraft.value = message.text
}

const saveEdit = (): void => {
  const id = editingId.value
  const text = editDraft.value.trim()
  if (!id || !text) return
  comments.editHumanMessage(id, text).then(() => {
    if (editingId.value === id) editingId.value = null
  }).catch(() => undefined)
}

const removeMessage = (id: string): void => {
  if (id === lastHumanId.value) return
  menuId.value = null
  comments.deleteHumanMessage(id).catch(() => undefined)
}

const addReply = (text: string): Promise<void> => {
  const id = thread.value?.id
  if (!id) return Promise.resolve()
  return comments.addHumanMessage(id, text).then(() => undefined)
}

const toggleStatus = (): void => {
  const current = thread.value
  if (!current) return
  const status = current.status === 'open' ? 'closed' : 'open'
  comments.setStatus(current.id, status).catch(() => undefined)
}

const confirmDelete = (): void => {
  const id = thread.value?.id
  if (!id) return
  comments.deleteThread(id).then(() => {
    confirming.value = false
  }).catch(() => undefined)
}

const sendAll = (): void => {
  sendCommentThreads('all').catch(() => undefined)
}

const sendSelected = (): void => {
  sendCommentThreads('selected').catch(() => undefined)
}

const showInText = (): void => {
  bus.emit('agent:show-in-text')
}

const cancelTurn = (): void => {
  bus.emit('agent:cancel-turn')
}
</script>
