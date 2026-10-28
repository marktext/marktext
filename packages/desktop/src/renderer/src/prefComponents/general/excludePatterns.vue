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
    <div
      v-for="(_, index) in patterns"
      :key="index"
      class="pattern-row"
    >
      <el-input
        v-model="patterns[index]"
        :aria-label="t('preferences.general.sidebar.patternLabel', { number: index + 1 })"
        :disabled="busy"
        @change="(text: string) => replacePattern(index, text)"
      />
      <el-button
        :disabled="busy"
        :aria-label="t('preferences.general.sidebar.removePatternLabel', { number: index + 1 })"
        @click="removePattern(index)"
      >
        {{ t('preferences.general.sidebar.removePattern') }}
      </el-button>
    </div>
    <form
      class="pattern-row"
      @submit.prevent="addPattern"
    >
      <el-input
        v-model="newPattern"
        :aria-label="t('preferences.general.sidebar.newPattern')"
        :placeholder="t('preferences.general.sidebar.patternExample')"
        :disabled="busy"
      />
      <el-button
        native-type="submit"
        :disabled="busy || !newPattern"
      >
        {{ t('preferences.general.sidebar.addPattern') }}
      </el-button>
    </form>
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
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import LinkIcon from '@/components/icons/LinkIcon.vue'
import type { PreferenceUpdateResult, UserPreferences } from '@shared/types/preferences'

const props = defineProps<{
  value: string[]
  update: (patch: Pick<UserPreferences, 'treePathExcludePatterns'>) => Promise<PreferenceUpdateResult>
}>()
const emit = defineEmits<{ persisted: [preferences: UserPreferences] }>()
const { t } = useI18n()
const newPattern = ref('')
const busy = ref(false)
const error = ref(false)
const patterns = ref([...props.value])
watch(() => props.value, (value) => { patterns.value = [...value] })

const save = async (next: string[], added = false): Promise<void> => {
  if (busy.value) return
  busy.value = true
  error.value = false
  try {
    const result = await props.update({ treePathExcludePatterns: next })
    if (result.status === 'persisted') {
      patterns.value = [...result.preferences.treePathExcludePatterns]
      emit('persisted', result.preferences)
      if (added) newPattern.value = ''
    } else {
      patterns.value = [...props.value]
      error.value = true
    }
  } catch {
    patterns.value = [...props.value]
    error.value = true
  } finally {
    busy.value = false
  }
}

const replacePattern = (index: number, pattern: string): void => {
  const next = [...props.value]
  next[index] = pattern
  void save(next)
}
const removePattern = (index: number): void => {
  void save(props.value.filter((_, position) => position !== index))
}
const addPattern = (): void => {
  if (!newPattern.value) return
  void save([...props.value, newPattern.value], true)
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
.pattern-row {
  display: flex;
  gap: 8px;
  margin: 8px 0;
}
.pattern-row .el-input {
  --el-input-bg-color: transparent;
  --el-input-text-color: var(--editorColor);
  --el-input-border-color: var(--editorColor10);
  --el-input-hover-border-color: var(--editorColor30);
  --el-input-focus-border-color: var(--themeColor);
  --el-input-placeholder-color: var(--editorColor30);

  min-width: 0;
}
.pattern-row :deep(input.el-input__inner) {
  background: transparent;
  border: none;
  color: var(--editorColor);
}
.pattern-row .el-button {
  flex-shrink: 0;
}
</style>
