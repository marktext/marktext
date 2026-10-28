<template>
  <section class="exclude-patterns">
    <h6>
      <span>{{ t('preferences.general.sidebar.excludePatterns') }}</span>
      <button
        type="button"
        class="plain-button pattern-help"
        :aria-label="t('preferences.general.sidebar.patternHelp')"
        @click="openHelp"
      >
        <LinkIcon :size="14" />
      </button>
    </h6>
    <p class="notes">
      {{ t('preferences.general.sidebar.excludePatternsNotes') }}
    </p>
    <el-config-provider :locale="inputTagLocale">
      <el-input-tag
        :model-value="value"
        :aria-label="t('preferences.general.sidebar.newPattern')"
        :placeholder="t('preferences.general.sidebar.patternExample')"
        :disabled="busy"
        @input="(text: string) => { draft = text }"
        @update:model-value="updatePatterns"
      />
    </el-config-provider>
    <p
      v-if="error"
      class="notes"
      role="alert"
    >
      {{ t('preferences.general.sidebar.patternSaveError') }}
    </p>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import LinkIcon from '@/components/icons/LinkIcon.vue'
import type { PreferenceUpdateResult, UserPreferences } from '@shared/types/preferences'

const props = defineProps<{
  value: string[]
  update: (patch: Pick<UserPreferences, 'treePathExcludePatterns'>) => Promise<PreferenceUpdateResult>
}>()
const emit = defineEmits<{ persisted: [preferences: UserPreferences] }>()
const { t, locale } = useI18n()
const inputTagLocale = computed(() => ({
  name: locale.value,
  el: { tag: { close: t('preferences.general.sidebar.removePattern') } }
}))
const draft = ref('')
const busy = ref(false)
const error = ref(false)

const save = async (next: string[]): Promise<void> => {
  if (busy.value) return
  busy.value = true
  error.value = false
  try {
    const result = await props.update({ treePathExcludePatterns: next })
    if (result.status === 'persisted') {
      emit('persisted', result.preferences)
    } else {
      error.value = true
    }
  } catch {
    error.value = true
  } finally {
    busy.value = false
  }
}

const updatePatterns = (value: string[] | undefined): void => {
  const next = [...(value ?? [])]
  // InputTag trims new tags; whitespace can be part of a glob filename.
  if (next.length === props.value.length + 1 && draft.value) {
    next[next.length - 1] = draft.value
  }
  draft.value = ''
  void save(next)
}
const openHelp = (): void => {
  window.electron.shell.openExternal('https://github.com/isaacs/minimatch')
}
</script>

<style scoped>
.exclude-patterns {
  margin: 20px 0;
}
.exclude-patterns h6 {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 8px;
}
.pattern-help {
  display: inline-flex;
  align-items: center;
  color: var(--iconColor);
  opacity: 0.7;
}
.pattern-help:hover,
.pattern-help:focus-visible {
  color: var(--themeColor);
  opacity: 1;
}
.exclude-patterns :deep(.el-input-tag) {
  --el-fill-color-blank: transparent;
  --el-fill-color-light: transparent;
  --el-border-color: var(--editorColor10);
  --el-border-color-hover: var(--editorColor30);
  --el-color-primary: var(--themeColor);
  --el-text-color-regular: var(--editorColor);
  --el-text-color-placeholder: var(--editorColor30);

  margin: 8px 0;
}
.exclude-patterns :deep(.el-input-tag__input) {
  background: transparent;
  color: var(--editorColor);
}
.exclude-patterns :deep(.el-tag) {
  --el-tag-bg-color: var(--editorColor04);
  --el-tag-border-color: var(--editorColor10);
  --el-tag-text-color: var(--editorColor);
}
.exclude-patterns :deep(.el-tag__content) {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
</style>
