<template>
  <div class="mt-diff">
    <div class="diffhead">
      <p class="hint">
        {{ t('diff.hint') }}
      </p>
      <div
        class="choices"
        role="group"
        :aria-label="t('diff.scope')"
      >
        <button
          type="button"
          class="choice"
          :aria-pressed="scope === 'turn'"
          :disabled="!turn"
          @click="setScope('turn')"
        >
          {{ turnLabel }}
        </button>
        <button
          type="button"
          class="choice"
          :aria-pressed="scope === 'worktree'"
          @click="setScope('worktree')"
        >
          {{ workLabel }}
        </button>
      </div>
      <div
        class="choices"
        role="group"
        :aria-label="t('diff.view')"
      >
        <button
          type="button"
          class="choice"
          :aria-pressed="view === 'unified'"
          @click="setView('unified')"
        >
          {{ t('diff.unified') }}
        </button>
        <button
          type="button"
          class="choice"
          :aria-pressed="view === 'side'"
          @click="setView('side')"
        >
          {{ t('diff.sideBySide') }}
        </button>
      </div>
      <button
        type="button"
        class="refresh"
        @click="refresh"
      >
        {{ t('diff.refresh') }}
      </button>
      <span
        v-if="fresh"
        class="fresh"
      >{{ t('diff.refreshed') }}</span>
    </div>
    <p
      v-if="truncated"
      class="banner"
    >
      {{ t('diff.truncated') }}
    </p>
    <p
      v-if="errorText"
      class="banner"
    >
      {{ errorText }}
    </p>
    <p
      v-if="showEmpty"
      class="empty"
    >
      {{ t('diff.empty') }}
    </p>
    <div
      v-else-if="files.length > 0"
      class="split"
    >
      <nav
        class="files"
        :aria-label="t('diff.files')"
      >
        <button
          v-for="(file, index) in files"
          :key="`${file.kind}:${file.path}`"
          type="button"
          class="file"
          :aria-current="index === current ? 'true' : undefined"
          :aria-label="fileLabel(file)"
          @click="focusFile(index)"
        >
          <span
            class="badge"
            :data-kind="file.kind"
            aria-hidden="true"
          >{{ file.kind }}</span>
          <span class="path">{{ file.path }}</span>
          <span class="stat">
            <span class="plus">+{{ file.added }}</span>
            <span class="minus">−{{ file.deleted }}</span>
          </span>
        </button>
      </nav>
      <!-- eslint-disable vue/no-v-html -->
      <div
        ref="pane"
        class="pane"
        v-html="html"
      />
      <!-- eslint-enable vue/no-v-html -->
    </div>
  </div>
</template>

<script setup lang="ts">
import { html as diffHtml } from 'diff2html'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { entriesFromPatch, type DiffEntry } from '@/agent/diffFiles'
import { useDiffStore } from '@/store/diff'
import { PREVIEW_DOMPURIFY_CONFIG, sanitize } from '@/util/dompurify'

const { t } = useI18n()
const diffStore = useDiffStore()
const { scope, view, turn } = storeToRefs(diffStore)

const turnPatch = ref('')
const workPatch = ref('')
const turnTruncated = ref(false)
const workTruncated = ref(false)
const turnLoaded = ref(false)
const workLoaded = ref(false)
const loadingTurn = ref(false)
const loadingWork = ref(false)
const workCount = ref<number | null>(null)
const errorText = ref('')
const fresh = ref(false)
const current = ref(0)
const pane = ref<HTMLElement | null>(null)

let turnToken = 0
let workToken = 0

const turnLabel = computed(() => {
  const currentTurn = turn.value
  if (!currentTurn) return t('diff.turnScope', { time: '', n: 0 })
  const time = new Date(currentTurn.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return t('diff.turnScope', { time, n: currentTurn.paths.length })
})

const workLabel = computed(() => {
  if (workCount.value == null) return t('diff.workScopePending')
  return t('diff.workScope', { n: workCount.value })
})

const activePatch = computed(() => scope.value === 'turn' ? turnPatch.value : workPatch.value)
const truncated = computed(() => scope.value === 'turn' ? turnTruncated.value : workTruncated.value)
const loading = computed(() => scope.value === 'turn' ? loadingTurn.value : loadingWork.value)
const loaded = computed(() => scope.value === 'turn' ? turnLoaded.value : workLoaded.value)
const files = computed(() => entriesFromPatch(activePatch.value))
const showEmpty = computed(() => loaded.value && !loading.value && errorText.value === '' && files.value.length === 0)

const html = computed(() => {
  const patch = activePatch.value
  if (patch.trim().length === 0) return ''
  return sanitize(diffHtml(patch, {
    drawFileList: false,
    outputFormat: view.value === 'side' ? 'side-by-side' : 'line-by-line',
    matching: 'lines',
    renderNothingWhenEmpty: true
  }), PREVIEW_DOMPURIFY_CONFIG)
})

const fileLabel = (file: DiffEntry): string => {
  const kind = file.kind === 'A'
    ? t('diff.added')
    : file.kind === 'D'
      ? t('diff.deleted')
      : file.kind === 'R'
        ? t('diff.renamed')
        : t('diff.modified')
  return t('diff.fileLabel', { kind, path: file.path, add: file.added, del: file.deleted })
}

const setScope = (next: 'turn' | 'worktree'): void => {
  fresh.value = false
  diffStore.setScope(next)
}

const setView = (next: 'unified' | 'side'): void => {
  diffStore.setView(next)
}

const applyTurn = async (manual: boolean): Promise<void> => {
  const token = ++turnToken
  const paths = turn.value?.paths
  if (!paths || paths.length === 0) {
    turnPatch.value = ''
    turnTruncated.value = false
    turnLoaded.value = true
    loadingTurn.value = false
    return
  }
  loadingTurn.value = true
  try {
    const result = await window.agent.gitDiff({ paths: [...paths] })
    if (token !== turnToken) return
    turnPatch.value = result.patch
    turnTruncated.value = result.truncated === true
    errorText.value = ''
    if (manual) fresh.value = true
  } catch (error) {
    if (token !== turnToken) return
    errorText.value = error instanceof Error ? error.message : String(error)
  } finally {
    if (token === turnToken) {
      loadingTurn.value = false
      turnLoaded.value = true
    }
  }
}

const applyWork = async (manual: boolean): Promise<void> => {
  const token = ++workToken
  loadingWork.value = true
  try {
    const result = await window.agent.gitDiff({})
    if (token !== workToken) return
    workPatch.value = result.patch
    workTruncated.value = result.truncated === true
    workCount.value = entriesFromPatch(result.patch).length
    errorText.value = ''
    if (manual) fresh.value = true
  } catch (error) {
    if (token !== workToken) return
    errorText.value = error instanceof Error ? error.message : String(error)
  } finally {
    if (token === workToken) {
      loadingWork.value = false
      workLoaded.value = true
    }
  }
}

const refresh = (): void => {
  const run = scope.value === 'turn' ? applyTurn(true) : applyWork(true)
  run.catch(() => undefined)
}

const focusFile = (index: number): void => {
  current.value = index
  const box = pane.value
  const node = box?.querySelectorAll('.d2h-file-wrapper')[index]
  if (!box || !(node instanceof HTMLElement)) return
  const top = node.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop
  box.scrollTop = top
}

watch(files, () => {
  current.value = 0
})

watch(
  () => `${turn.value?.turnId ?? ''}\0${turn.value?.paths.join('\0') ?? ''}`,
  () => {
    fresh.value = false
    applyTurn(false).catch(() => undefined)
    applyWork(false).catch(() => undefined)
  },
  { immediate: true }
)
</script>

<style scoped>
.mt-diff {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--editorBgColor);
  color: var(--editorColor);
  --diffInsBg: rgba(33, 181, 111, 0.18);
  --diffDelBg: rgba(180, 48, 48, 0.16);
  --diffInfoBg: var(--editorColor10);
  --diffInsFg: #146c3a;
  --diffDelFg: #7a1e1e;
}

.diffhead {
  flex: none;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--editorColor10);
}

.hint {
  flex: 1 0 100%;
  margin: 0;
  font-size: 12px;
  color: var(--editorColor50);
}

.choices {
  display: inline-flex;
  flex-wrap: wrap;
}

.choice {
  background: transparent;
  border: 1px solid var(--editorColor10);
  color: var(--editorColor);
  padding: 3px 8px;
  font-size: 12px;
  cursor: pointer;
}

.choices .choice + .choice {
  margin-left: -1px;
}

.choice[aria-pressed='true'] {
  color: var(--editorColor80);
  background: var(--themeColor10);
  box-shadow: inset 0 -2px 0 var(--themeColor);
  position: relative;
  z-index: 1;
}

.choice:disabled {
  cursor: default;
  opacity: 0.6;
}

.refresh {
  margin-left: auto;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--sideBarTitleColor);
  font-size: 12px;
  padding: 3px 6px;
}

.fresh {
  font-size: 12px;
  color: var(--editorColor50);
}

.banner {
  flex: none;
  margin: 0;
  padding: 6px 12px;
  font-size: 12px;
  background: var(--themeColor10);
  color: var(--editorColor80);
}

.split {
  flex: 1;
  min-height: 0;
  display: flex;
}

.files {
  width: 240px;
  flex: none;
  overflow: auto;
  border-right: 1px solid var(--editorColor10);
  background: var(--sideBarBgColor);
  color: var(--sideBarColor);
}

.file {
  width: 100%;
  display: grid;
  grid-template-columns: 16px minmax(0, 1fr) auto;
  gap: 6px;
  align-items: center;
  padding: 6px 8px;
  border: none;
  background: none;
  color: inherit;
  text-align: left;
  cursor: pointer;
  font-size: 13px;
}

.file[aria-current='true'] {
  box-shadow: inset 2px 0 0 var(--themeColor);
  color: var(--sideBarTitleColor);
}

.badge {
  font-size: 11px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.badge[data-kind='A'] {
  color: var(--diffInsFg);
}

.badge[data-kind='D'] {
  color: var(--diffDelFg);
}

.badge[data-kind='M'],
.badge[data-kind='R'] {
  color: var(--sideBarTitleColor);
}

.path {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stat {
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.plus {
  color: var(--diffInsFg);
}

.minus {
  color: var(--diffDelFg);
  margin-left: 4px;
}

.pane {
  flex: 1;
  min-width: 0;
  overflow: auto;
  position: relative;
  padding: 12px;
}

.empty {
  margin: auto;
  padding: 48px 16px;
  text-align: center;
  color: var(--editorColor50);
  font-size: 14px;
}

.mt-diff :deep(.d2h-file-wrapper) {
  border: 1px solid var(--editorColor10);
  margin: 0 0 12px;
  background: var(--editorBgColor);
}

.mt-diff :deep(.d2h-file-header) {
  padding: 6px 10px;
  background: var(--sideBarBgColor);
  color: var(--sideBarTitleColor);
  font-size: 12px;
}

.mt-diff :deep(.d2h-file-name) {
  font-family: "DejaVu Sans Mono", "Source Code Pro", monospace;
}

.mt-diff :deep(.d2h-file-collapse),
.mt-diff :deep(.d2h-tag) {
  display: none;
}

.mt-diff :deep(.d2h-icon) {
  fill: var(--iconColor);
  margin-right: 6px;
  vertical-align: middle;
}

.mt-diff :deep(.d2h-files-diff) {
  display: flex;
}

.mt-diff :deep(.d2h-file-side-diff) {
  width: 50%;
  overflow-x: auto;
}

.mt-diff :deep(.d2h-diff-table) {
  border-collapse: collapse;
  width: 100%;
  font-family: "DejaVu Sans Mono", "Source Code Pro", monospace;
  font-size: 12px;
  line-height: 1.45;
}

.mt-diff :deep(.d2h-code-linenumber),
.mt-diff :deep(.d2h-code-side-linenumber) {
  width: 1%;
  padding: 0 8px;
  text-align: right;
  vertical-align: top;
  color: var(--editorColor50);
  background: var(--diffInfoBg);
  user-select: none;
  white-space: nowrap;
}

.mt-diff :deep(.d2h-code-line),
.mt-diff :deep(.d2h-code-side-line),
.mt-diff :deep(.d2h-info-line) {
  padding: 0 8px;
  white-space: pre;
  vertical-align: top;
}

.mt-diff :deep(.d2h-del) {
  background: var(--diffDelBg);
}

.mt-diff :deep(.d2h-ins) {
  background: var(--diffInsBg);
}

.mt-diff :deep(.d2h-info) {
  background: var(--diffInfoBg);
  color: var(--editorColor50);
}

.mt-diff :deep(.d2h-code-line-prefix) {
  display: inline-block;
  width: 1.2em;
  color: var(--editorColor50);
}

.mt-diff :deep(.d2h-del .d2h-code-line-prefix) {
  color: var(--diffDelFg);
}

.mt-diff :deep(.d2h-ins .d2h-code-line-prefix) {
  color: var(--diffInsFg);
}
</style>
