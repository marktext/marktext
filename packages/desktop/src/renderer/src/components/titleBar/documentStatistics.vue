<template>
  <el-popover
    v-model:visible="visible"
    trigger="hover"
    placement="bottom-end"
    :width="280"
    :show-arrow="false"
    popper-class="document-statistics-popover"
    @show="refreshFileInfo"
  >
    <template #reference>
      <el-button
        class="word-count document-statistics-trigger title-no-drag"
        text
        :aria-label="t('titleBar.documentStatistics.open')"
        @click.stop="handleMetricClick"
      >
        <span class="document-statistics-trigger__label">{{ triggerLabel }}</span>{{ ' ' }}
        <span class="document-statistics-trigger__value">{{ triggerCount }}</span>
      </el-button>
    </template>

    <div
      class="document-statistics"
      role="dialog"
      :aria-label="t('titleBar.documentStatistics.title')"
    >
      <section class="document-statistics__section">
        <el-text
          class="document-statistics__heading"
          tag="div"
          type="info"
          size="small"
        >
          {{ t('titleBar.documentStatistics.title') }}
        </el-text>
        <div class="document-statistics__metrics">
          <div
            v-for="row in metricRows"
            :key="row.key"
            class="document-statistics__metric"
          >
            <span class="document-statistics__label">{{ row.label }}</span>
            <span class="document-statistics__value">{{ row.value }}</span>
          </div>
        </div>
      </section>

      <el-divider class="document-statistics__divider" />

      <section class="document-statistics__section">
        <div class="document-statistics__file-row document-statistics__reading-mode">
          <label
            class="document-statistics__file-label"
            for="document-reading-mode"
          >
            <el-icon class="document-statistics__icon"><Lock /></el-icon>
            {{ t('readingMode.title') }}
          </label>
          <el-switch
            id="document-reading-mode"
            class="document-statistics__mode-switch"
            :model-value="readOnly"
            :loading="modeChanging"
            :aria-label="t('readingMode.title')"
            @change="handleReadingChange"
          />
        </div>
      </section>

      <el-divider class="document-statistics__divider" />

      <section class="document-statistics__section">
        <el-text
          class="document-statistics__heading"
          tag="div"
          type="info"
          size="small"
        >
          {{ t('titleBar.documentStatistics.fileInformation') }}
        </el-text>
        <div class="document-statistics__file-info">
          <div class="document-statistics__file-row">
            <span class="document-statistics__file-label">
              <el-icon class="document-statistics__icon"><Calendar /></el-icon>
              {{ t('titleBar.documentStatistics.created') }}
            </span>
            <span class="document-statistics__file-value">{{ createdText }}</span>
          </div>
          <div class="document-statistics__file-row">
            <span class="document-statistics__file-label">
              <el-icon class="document-statistics__icon"><Clock /></el-icon>
              {{ t('titleBar.documentStatistics.lastModified') }}
            </span>
            <span class="document-statistics__file-value">{{ modifiedText }}</span>
          </div>
        </div>
      </section>
    </div>
  </el-popover>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Calendar, Clock, Lock } from '@element-plus/icons-vue'
import type { FileWordCount } from '@shared/types/files'
import { formatCountPair, formatTimestamp } from './documentStatisticsFormat'
import { loadStatMetric, saveStatMetric, type StatMetric } from './documentStatisticsPersistence'

const props = defineProps<{
  pathname?: string
  wordCount?: FileWordCount | null
  selectionWordCount?: FileWordCount | null
  isSaved?: boolean
  readOnly?: boolean
  modeChanging?: boolean
}>()

const emit = defineEmits<{
  'toggle-reading': [readOnly: boolean]
}>()

const { t, locale } = useI18n()

const handleReadingChange = (value: boolean | string | number): void => {
  emit('toggle-reading', Boolean(value))
}

interface MetricConfig {
  labelKey: string
}

const METRIC_KEYS: readonly StatMetric[] = ['word', 'character', 'paragraph', 'all']
const METRIC_CYCLE: readonly StatMetric[] = ['word', 'paragraph', 'character', 'all']
const METRIC_CONFIG: Record<StatMetric, MetricConfig> = {
  word: {
    labelKey: 'menu.counter.words'
  },
  character: {
    labelKey: 'menu.counter.characters'
  },
  paragraph: {
    labelKey: 'menu.counter.paragraphs'
  },
  all: {
    labelKey: 'menu.counter.charactersWithSpaces'
  }
}

const visible = ref(false)
const activeMetric = ref<StatMetric>(loadStatMetric())
const fileInfo = ref<{ createdAt: number | null; modifiedAt: number | null } | null>(null)
let fileInfoRequest = 0

const metricRows = computed(() => {
  const metrics = props.wordCount
  if (!metrics) return []

  return METRIC_KEYS.map((key) => ({
    key,
    label: t(METRIC_CONFIG[key].labelKey),
    value: formatCountPair(metrics[key], props.selectionWordCount?.[key], locale.value)
  }))
})

const triggerLabel = computed(() => t(METRIC_CONFIG[activeMetric.value].labelKey))
const triggerCount = computed(() =>
  formatCountPair(
    props.wordCount?.[activeMetric.value] ?? 0,
    props.selectionWordCount?.[activeMetric.value],
    locale.value
  )
)

const handleMetricClick = (): void => {
  const index = METRIC_CYCLE.indexOf(activeMetric.value)
  activeMetric.value = METRIC_CYCLE[(index + 1) % METRIC_CYCLE.length]!
}

const createdText = computed(
  () =>
    formatTimestamp(fileInfo.value?.createdAt, locale.value) ??
    t('titleBar.documentStatistics.unavailable')
)
const modifiedText = computed(
  () =>
    formatTimestamp(fileInfo.value?.modifiedAt, locale.value) ??
    t('titleBar.documentStatistics.unavailable')
)

const refreshFileInfo = async (): Promise<void> => {
  const pathname = props.pathname
  const request = ++fileInfoRequest
  if (!pathname) {
    fileInfo.value = null
    return
  }

  try {
    const stats = await window.fileUtils.stat(pathname)
    if (request !== fileInfoRequest) return
    fileInfo.value = {
      createdAt: stats.birthtimeMs > 0 ? stats.birthtimeMs : null,
      modifiedAt: stats.mtimeMs > 0 ? stats.mtimeMs : null
    }
  } catch {
    if (request === fileInfoRequest) fileInfo.value = null
  }
}

watch(activeMetric, saveStatMetric)

watch(
  () => props.pathname,
  () => {
    fileInfoRequest += 1
    fileInfo.value = null
  }
)

watch(
  () => props.isSaved,
  (saved, wasSaved) => {
    if (saved && !wasSaved && visible.value) void refreshFileInfo()
  }
)
</script>

<style scoped>
.document-statistics-trigger {
  -webkit-app-region: no-drag;
  height: 24px;
  margin-right: 10px;
  padding: 0 8px;
  border-radius: 6px;
  color: var(--editorColor50);
  font-size: 13px;
  line-height: 24px;
  transition: background-color 0.2s ease-in-out;
}

.document-statistics-trigger.el-button.is-text,
.document-statistics-trigger.el-button.is-text:hover,
.document-statistics-trigger.el-button.is-text:focus,
.document-statistics-trigger.el-button.is-text:focus-visible,
.document-statistics-trigger.el-button.is-text:active {
  border: 0 solid transparent;
  background-color: transparent;
  box-shadow: none;
}

.document-statistics-trigger.el-button.is-text:hover,
.document-statistics-trigger.el-button.is-text:focus-visible,
.document-statistics-trigger.el-button.is-text:active {
  background: var(--sideBarBgColor);
  color: var(--sideBarTitleColor);
}

.document-statistics-trigger.el-button.is-text:focus-visible {
  outline: 1px solid var(--themeColor);
  outline-offset: 1px;
}

.document-statistics-trigger__label {
  margin-right: 6px;
}

.document-statistics-trigger__value {
  color: inherit;
}

.document-statistics {
  color: var(--editorColor);
}

.document-statistics__section + .document-statistics__section {
  margin-top: 2px;
}

.document-statistics__heading {
  margin-bottom: 10px;
  color: var(--editorColor50);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  white-space: nowrap;
}

.document-statistics__metrics {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
}

.document-statistics__metric {
  width: 100%;
  height: 38px;
  padding: 0 8px;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  color: var(--editorColor);
  font-size: 14px;
}

.document-statistics__icon {
  flex: none;
  margin-right: 12px;
  color: var(--editorColor50);
  font-size: 18px;
}

.document-statistics__label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.document-statistics__value {
  flex: none;
  margin-left: auto;
  padding-left: 12px;
  color: var(--editorColor);
  font-variant-numeric: tabular-nums;
}

.document-statistics__divider {
  margin: 12px 0;
  border-color: var(--editorColor10);
}

.document-statistics__file-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  white-space: nowrap;
}

.document-statistics__mode-switch {
  margin-left: auto;
  flex: none;
}

.document-statistics__reading-mode .document-statistics__file-label {
  flex: 1;
  min-width: 0;
  white-space: normal;
}

.document-statistics__reading-mode .document-statistics__icon {
  flex-shrink: 0;
}

.document-statistics__file-row + .document-statistics__file-row {
  margin-top: 10px;
}

.document-statistics__file-info .document-statistics__file-row {
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
}

.document-statistics__file-label {
  flex: none;
  display: inline-flex;
  align-items: center;
  color: var(--editorColor);
  font-size: 14px;
  white-space: nowrap;
}

.document-statistics__file-value {
  flex: none;
  margin-left: auto;
  color: var(--editorColor50);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.document-statistics__file-info .document-statistics__file-value {
  margin-left: 0;
  padding-left: 30px;
}
</style>

<style>
.document-statistics-popover.el-popover.el-popper {
  padding: 18px;
  border: 1px solid var(--floatBorderColor);
  border-radius: 14px;
  background: var(--floatBgColor);
  box-shadow: var(--floatShadow);
  color: var(--editorColor);
}
</style>
