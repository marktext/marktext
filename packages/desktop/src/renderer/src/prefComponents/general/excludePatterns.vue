<template>
  <section class="exclude-patterns">
    <h6>{{ t('preferences.general.sidebar.excludePatterns') }}</h6>
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
    <el-button
      link
      @click="openHelp"
    >
      {{ t('preferences.general.sidebar.patternHelp') }}
    </el-button>
  </section>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
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
  margin-bottom: 8px;
}
.pattern-row {
  display: flex;
  gap: 8px;
  margin: 8px 0;
}
.pattern-row .el-input {
  min-width: 0;
}
.pattern-row .el-button {
  flex-shrink: 0;
}
</style>
