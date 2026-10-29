<template>
  <div
    id="setting-imageUploader"
    class="pref-image-uploader"
  >
    <cur-select
      :description="preferenceLabel('imageUploader')"
      :value="currentUploader"
      :options="uploaderOptions"
      :on-change="setCurrentUploader"
    />
    <section
      v-if="currentUploader === 'picgo'"
      class="picgo"
    >
      <command-detection
        :state="detectionState"
        :message="detectionMessage"
        @check="testPicgo"
      />
      <setting-note v-if="lastDetectionTime">
        {{ t('preferences.image.uploader.lastDetectionTime') }}: {{ formatDetectionTime(lastDetectionTime) }}
      </setting-note>
      <setting-note v-if="lastSuccessTime">
        {{ t('preferences.image.uploader.lastSuccessTime') }}: {{ formatDetectionTime(lastSuccessTime) }}
      </setting-note>
      <uploader-guide :show-installation="!picgoExists" />
      <details
        v-if="picgoDetectionFailed && picgoDebugInfo"
        class="debug-info"
      >
        <summary>{{ t('preferences.image.uploader.debugInfo') }}</summary>
        <pre>{{ picgoDebugInfo }}</pre>
      </details>
    </section>
    <section
      v-if="currentUploader === 'cliScript'"
      class="script"
    >
      <setting-note>{{ t('preferences.image.uploader.scriptDescription') }}</setting-note>
      <text-box
        id="setting-cliScript"
        :description="preferenceLabel('cliScript')"
        :input="prefCliScript"
        :default-value="t('preferences.image.uploader.scriptPath')"
        :validate="validateScript"
        :error-message="t('preferences.image.uploader.invalidScript')"
        :on-change="saveScript"
      />
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, onActivated, onDeactivated } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { usePreferencesStore } from '@/store/preferences'
import { isFileExecutable } from '@/util/fileSystem'
import { preferenceLabel } from '@/prefComponents/registry'
import CurSelect from '@/prefComponents/common/select/index.vue'
import TextBox from '@/prefComponents/common/textBox/index.vue'
import SettingNote from '@/prefComponents/common/settingNote.vue'
import CommandDetection from '@/prefComponents/common/commandDetection.vue'
import type { CommandDetectionState, PrefSelectOption } from '@/prefComponents/common/types'
import getServices from './services'
import UploaderGuide from './guide.vue'

const { t, locale } = useI18n()
const preferenceStore = usePreferencesStore()
const { currentUploader, cliScript: prefCliScript } = storeToRefs(preferenceStore)
const uploaderOptions = computed<PrefSelectOption<string>[]>(() =>
  Object.entries(getServices()).map(([value, service]) => ({ value, label: service.name }))
)
const picgoExists = ref(false)
const picgoDetectionFailed = ref(false)
const picgoDebugInfo = ref('')
const isDetecting = ref(false)
const lastDetectionTime = ref<string | null>(null)
const lastSuccessTime = ref<string | null>(null)
const consecutiveFailures = ref(0)
const isPageVisible = ref(true)
let detectionTimer: ReturnType<typeof setTimeout> | undefined
let detectionGeneration = 0

const detectionState = computed<CommandDetectionState>(() => {
  if (isDetecting.value || !lastDetectionTime.value) return 'checking'
  if (picgoDetectionFailed.value) return 'failed'
  return picgoExists.value ? 'found' : 'not-found'
})
const detectionMessage = computed(() => {
  if (picgoDetectionFailed.value) return t('preferences.image.uploader.picgoDetectionFailed')
  return t(picgoExists.value ? 'preferences.image.uploader.picgoInstalled' : 'preferences.image.uploader.picgoNotInstalled')
})

const validateScript = (value: string): boolean | Promise<boolean> => {
  if (!value) return false
  return isFileExecutable(value)
}
const saveScript = (value: string): void => {
  preferenceStore.SET_USER_DATA({ type: 'cliScript', value })
}
const setCurrentUploader = (value: string | number | boolean): void => {
  preferenceStore.SET_USER_DATA({ type: 'currentUploader', value })
}
const formatDetectionTime = (time: string): string => new Date(time).toLocaleString(locale.value)

const testPicgo = async(): Promise<void> => {
  if (isDetecting.value) return
  isDetecting.value = true
  lastDetectionTime.value = new Date().toISOString()
  const debugMessages = [
    `Detection time: ${lastDetectionTime.value}`,
    `Platform: ${window.process?.platform || 'unknown'}`
  ]
  try {
    if (!window.commandExists || typeof window.commandExists.exists !== 'function') {
      throw new Error('Command detection bridge is unavailable')
    }
    const [nodeExists, npmExists, result] = await Promise.all([
      window.commandExists.exists('node'),
      window.commandExists.exists('npm'),
      window.commandExists.exists('picgo')
    ])
    debugMessages.push(`Node.js detected: ${nodeExists}`, `npm detected: ${npmExists}`, `PicGo-Core detected: ${result}`)
    picgoExists.value = result
    picgoDetectionFailed.value = false
    if (result) {
      lastSuccessTime.value = new Date().toISOString()
      consecutiveFailures.value = 0
    } else {
      debugMessages.push('PicGo-Core was not found. Check its installation and PATH in the Electron environment.')
    }
  } catch (error) {
    picgoExists.value = false
    picgoDetectionFailed.value = true
    consecutiveFailures.value++
    debugMessages.push(error instanceof Error ? error.stack || error.message : String(error))
  } finally {
    picgoDebugInfo.value = debugMessages.join('\n')
    isDetecting.value = false
  }
}

const stopRealtimeDetection = (): void => {
  detectionGeneration++
  if (detectionTimer) clearTimeout(detectionTimer)
  detectionTimer = undefined
}
const scheduleNextDetection = (generation: number): void => {
  if (generation !== detectionGeneration || !isPageVisible.value || currentUploader.value !== 'picgo') return
  const interval = Math.min(30_000 * 2 ** consecutiveFailures.value, 300_000)
  detectionTimer = setTimeout(async() => {
    await testPicgo()
    scheduleNextDetection(generation)
  }, interval)
}
const startRealtimeDetection = (): void => {
  stopRealtimeDetection()
  if (!isPageVisible.value || currentUploader.value !== 'picgo') return
  const generation = detectionGeneration
  void testPicgo().then(() => scheduleNextDetection(generation))
}
const handleVisibilityChange = (): void => {
  isPageVisible.value = !document.hidden
  if (isPageVisible.value) {
    startRealtimeDetection()
  } else {
    stopRealtimeDetection()
  }
}
watch(currentUploader, startRealtimeDetection)
onMounted(() => {
  document.addEventListener('visibilitychange', handleVisibilityChange)
  startRealtimeDetection()
})
onActivated(() => {
  isPageVisible.value = true
  startRealtimeDetection()
})
onDeactivated(() => {
  isPageVisible.value = false
  stopRealtimeDetection()
})
onUnmounted(() => {
  stopRealtimeDetection()
  document.removeEventListener('visibilitychange', handleVisibilityChange)
})
</script>

<style scoped>
.pref-image-uploader { color: var(--editorColor); font-size: 14px; }
.debug-info { margin-top: 16px; }
.debug-info summary { cursor: pointer; }
.debug-info pre {
  max-height: 200px;
  overflow: auto;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
</style>
