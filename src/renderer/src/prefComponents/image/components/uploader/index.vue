<template>
  <div class="pref-image-uploader">
    <h5>{{ t('preferences.image.uploader.title') }}</h5>
    <section class="current-uploader">
      <div v-if="isValidUploaderService(currentUploader)">
        {{
          t('preferences.image.uploader.currentUploader', {
            name: getServiceNameById(currentUploader)
          })
        }}
      </div>
      <span v-else>{{ t('preferences.image.uploader.noUploaderSelected') }}</span>
    </section>
    <section class="configration">
      <cur-select
        :value="currentUploader"
        :options="uploaderOptions"
        :on-change="(value) => setCurrentUploader(value)"
      />
      <div
        v-if="currentUploader === 'picgo'"
        class="picgo"
      >
        <div class="detection-status">
          <div class="detection-header">
            <h6>{{ t('preferences.image.uploader.picgoDetection') }}</h6>
            <div class="detection-controls">
              <!-- Standalone refresh button -->
              <button
                v-if="showStandaloneRefreshButton"
                class="standalone-refresh-button"
                :disabled="isDetecting"
                :title="t('preferences.image.uploader.retestPicgo')"
                @click="manualDetection"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <polyline points="23 4 23 10 17 10" />
                  <polyline points="1 20 1 14 7 14" />
                  <path d="m3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                </svg>
              </button>
              <div class="detection-status-indicator">
                <!-- Loading animation and status indicator -->
                <div class="detection-animation-container">
                  <!-- Initial button (becomes animation after 0.5 seconds) -->
                  <button
                    v-if="showInitialButton"
                    class="initial-button"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <circle
                        cx="12"
                        cy="12"
                        r="10"
                      />
                      <path d="m9 12 2 2 4-4" />
                    </svg>
                  </button>
                  <!-- Loading animation -->
                  <div
                    v-if="showLoadingAnimation"
                    class="loading-dot"
                    :class="{ animate: animationActive }"
                  />
                  <!-- Status indicator button (icon removed) -->
                  <button
                    v-if="showStatusIndicator"
                    class="status-indicator"
                    :class="getStatusIndicatorClass()"
                    @click="manualDetection"
                  >
                    <!-- All SVG icons removed -->
                  </button>
                  <!-- Refresh button -->
                  <button
                    v-if="showRefreshButton"
                    class="refresh-button"
                    :disabled="isDetecting"
                    @click="manualDetection"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <polyline points="23 4 23 10 17 10" />
                      <polyline points="1 20 1 14 7 14" />
                      <path
                        d="m3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div :class="['status-info', picgoExists ? 'success' : 'warning']">
            <div class="status-text">
              {{ picgoDetectionStatus || t('preferences.image.uploader.picgoNotInstalled') }}
            </div>
            <div
              v-if="lastDetectionTime"
              class="detection-time"
            >
              {{ t('preferences.image.uploader.lastDetectionTime') }}:
              {{ formatDetectionTime(lastDetectionTime) }}
            </div>
            <div
              v-if="lastSuccessTime"
              class="success-time"
            >
              {{ t('preferences.image.uploader.lastSuccessTime') }}: {{ getLastSuccessTime() }}
            </div>
          </div>
          <div
            v-if="!picgoExists"
            class="install-commands"
          >
            <div class="install-title">
              {{ t('preferences.image.uploader.chooseInstallMethod') }}
            </div>
            <div class="install-options">
              <div class="install-option">
                <strong>npm:</strong>
                <code class="install-command">{{
                  t('preferences.image.uploader.npmInstallCommand')
                }}</code>
              </div>
              <div class="install-option">
                <strong>yarn:</strong>
                <code class="install-command">{{
                  t('preferences.image.uploader.yarnInstallCommand')
                }}</code>
              </div>
              <div class="install-option">
                <strong>pnpm:</strong>
                <code class="install-command">{{
                  t('preferences.image.uploader.pnpmInstallCommand')
                }}</code>
              </div>
            </div>
            <div class="install-link">
              <span
                class="link"
                @click="open('https://github.com/PicGo/PicGo-Core')"
              >picgo</span>
              {{ t('preferences.image.uploader.pleaseInstall') }}
            </div>
          </div>

          <!-- PicGo basic usage guide -->
          <div class="usage-guide">
            <div class="usage-title">
              {{ t('preferences.image.uploader.usageGuide.title') }}
            </div>
            <div class="usage-content">
              <div class="usage-step">
                <strong>1. {{ t('preferences.image.uploader.usageGuide.step1') }}</strong>
                <div class="usage-description">
                  {{ t('preferences.image.uploader.usageGuide.step1Description') }}
                </div>
                <code class="usage-command">picgo set uploader</code>
              </div>
              <div class="usage-step">
                <strong>2. {{ t('preferences.image.uploader.usageGuide.step2') }}</strong>
                <div class="usage-description">
                  {{ t('preferences.image.uploader.usageGuide.step2Description') }}
                </div>
                <code class="usage-command">picgo upload /path/to/image.png</code>
              </div>
              <div class="usage-step">
                <strong>3. {{ t('preferences.image.uploader.usageGuide.step3') }}</strong>
                <div class="usage-description">
                  {{ t('preferences.image.uploader.usageGuide.step3Description') }}
                </div>
                <code class="usage-command">picgo config</code>
              </div>
            </div>
            <div class="usage-link">
              <span
                class="link"
                @click="open('https://picgo.github.io/PicGo-Core-Doc/')"
              >{{
                t('preferences.image.uploader.usageGuide.documentation')
              }}</span>
            </div>
          </div>

          <details
            v-if="picgoDetectionFailed && picgoDebugInfo"
            class="debug-info"
          >
            <summary>{{ t('preferences.image.uploader.debugInfo') }}</summary>
            <pre>{{ picgoDebugInfo || '暂无调试信息' }}</pre>
          </details>
        </div>
      </div>
      <div
        v-if="currentUploader === 'github'"
        class="github"
      >
        <div class="warning">
          {{ t('preferences.image.uploader.githubDeprecated') }}
        </div>
        <div class="form-group">
          <div class="label">
            {{ t('preferences.image.uploader.githubToken') }}:
            <el-tooltip
              class="item"
              effect="dark"
              :content="t('preferences.image.uploader.tokenTooltip')"
              placement="top-start"
            >
              <InfoFilled
                width="16"
                height="16"
              />
            </el-tooltip>
          </div>
          <el-input
            v-model="githubToken"
            :placeholder="t('preferences.image.uploader.inputToken')"
            size="mini"
          />
        </div>
        <div class="form-group">
          <div class="label">
            {{ t('preferences.image.uploader.ownerName') }}:
          </div>
          <el-input
            v-model="github.owner"
            :placeholder="t('preferences.image.uploader.owner')"
            size="mini"
          />
        </div>
        <div class="form-group">
          <div class="label">
            {{ t('preferences.image.uploader.repoName') }}:
          </div>
          <el-input
            v-model="github.repo"
            :placeholder="t('preferences.image.uploader.repo')"
            size="mini"
          />
        </div>
        <div class="form-group">
          <div class="label">
            {{ t('preferences.image.uploader.branchName') }}:
          </div>
          <el-input
            v-model="github.branch"
            :placeholder="t('preferences.image.uploader.branch')"
            size="mini"
          />
        </div>
        <legal-notices-checkbox
          class="github"
          :class="[{ error: legalNoticesErrorStates.github }]"
          :uploader-service="uploadServices.github"
        />
        <div class="form-group">
          <el-button
            size="mini"
            :disabled="githubDisable"
            @click="save('github')"
          >
            {{ t('preferences.image.uploader.save') }}
          </el-button>
        </div>
      </div>
      <div
        v-else-if="currentUploader === 'cliScript'"
        class="script"
      >
        <div class="description">
          {{ t('preferences.image.uploader.scriptDescription') }}
        </div>
        <div class="form-group">
          <div class="label">
            {{ t('preferences.image.uploader.scriptLocation') }}:
          </div>
          <el-input
            v-model="cliScript"
            :placeholder="t('preferences.image.uploader.scriptPath')"
            size="mini"
          />
        </div>
        <div class="form-group">
          <el-button
            size="mini"
            :disabled="cliScriptDisable"
            @click="save('cliScript')"
          >
            {{ t('preferences.image.uploader.save') }}
          </el-button>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import {
  ref,
  reactive,
  computed,
  watch,
  onMounted,
  nextTick,
  onUnmounted,
  onActivated,
  onDeactivated
} from 'vue'
import { useI18n } from 'vue-i18n'
import { usePreferencesStore } from '@/store/preferences'
import getServices, { isValidService } from './services'
import type { UploaderService, UploaderServiceId } from './services'
import legalNoticesCheckbox from './legalNoticesCheckbox.vue'
import { isFileExecutable } from '@/util/fileSystem'
import CurSelect from '@/prefComponents/common/select/index.vue'
import notice from '@/services/notification'
import { storeToRefs } from 'pinia'
import { InfoFilled } from '@element-plus/icons-vue'
import type { PrefSelectOption } from '@/prefComponents/common/types'

const { t } = useI18n()

// store
const preferenceStore = usePreferencesStore()

// data
const uploaderOptions: PrefSelectOption<string>[] = Object.keys(getServices()).map((name) => {
  const services = getServices()
  const { name: label } = services[name as UploaderServiceId]
  return {
    label,
    value: name
  }
})
const githubToken = ref<string>('')
const github = reactive({
  owner: '',
  repo: '',
  branch: ''
})
const cliScript = ref<string>('')
const picgoExists = ref<boolean>(false)
const picgoDetectionFailed = ref<boolean>(false) // Whether detection failed
const picgoDetectionStatus = ref<string>('') // Detection status text
const picgoDebugInfo = ref<string>('') // Debug information
const isDetecting = ref<boolean>(false) // Whether detection is in progress
const lastDetectionTime = ref<string | null>(null) // Last detection time
const lastSuccessTime = ref<string | null>(null) // Last successful detection time
const detectionTimer = ref<ReturnType<typeof setTimeout> | null>(null) // Detection interval constant moved into scheduleNextDetection function
const consecutiveFailures = ref<number>(0) // Number of consecutive failures
const isPageVisible = ref<boolean>(true) // Whether the page is visible
// Animation and button control state
const showLoadingAnimation = ref<boolean>(false) // Whether to show the loading animation
const showRefreshButton = ref<boolean>(false) // Whether to show the refresh button
const showInitialButton = ref<boolean>(false) // Whether to show the initial button (becomes animation after 0.5 seconds)
const showStatusIndicator = ref<boolean>(false) // Whether to show the status indicator
const animationActive = ref<boolean>(false) // Whether the animation is active
const animationTimer = ref<ReturnType<typeof setInterval> | null>(null) // Animation timer
const buttonTimer = ref<ReturnType<typeof setTimeout> | null>(null) // Button display timer
const initialButtonTimer = ref<ReturnType<typeof setTimeout> | null>(null) // Initial button timer
const showStandaloneRefreshButton = ref<boolean>(true) // Whether to show the standalone refresh button
const uploadServices: Record<UploaderServiceId, UploaderService> = getServices()
const legalNoticesErrorStates = reactive<Record<string, boolean>>({
  github: false
})

// computed
const {
  currentUploader,
  imageBed,
  githubToken: prefGithubToken,
  cliScript: prefCliScript
} = storeToRefs(preferenceStore)

const githubDisable = computed(() => !githubToken.value || !github.owner || !github.repo)
// `isFileExecutable` is async via IPC; track the result in a ref so the
// disabled state still updates reactively.
const cliScriptExecutable = ref(false)
watch(
  cliScript,
  async (value) => {
    if (!value) {
      cliScriptExecutable.value = false
      return
    }
    try {
      cliScriptExecutable.value = await isFileExecutable(value)
    } catch {
      cliScriptExecutable.value = false
    }
  },
  { immediate: true }
)
const cliScriptDisable = computed(() => !cliScript.value || !cliScriptExecutable.value)

// watch
watch(imageBed, (value, oldValue) => {
  if (JSON.stringify(value) !== JSON.stringify(oldValue)) {
    Object.assign(github, value.github)
  }
})

// Listen for uploader switch; immediately start detection when switching to picgo
watch(currentUploader, (newValue, oldValue) => {
  console.log('=== watch currentUploader 触发 ===', oldValue, '->', newValue)

  if (newValue === 'picgo') {
    // Switch to picgo: immediately start the detection flow
    console.log('切换到picgo，启动检测流程')
    startRealtimeDetection()
  } else if (oldValue === 'picgo') {
    // Switch away from picgo: stop detection
    console.log('从picgo切换到其他上传器，停止检测')
    stopRealtimeDetection()
    // Reset UI state
    showInitialButton.value = false
    showLoadingAnimation.value = false
    showRefreshButton.value = false
    showStatusIndicator.value = false
    animationActive.value = false
  }
})

// Get dynamic detection interval
// getDetectionInterval function removed; logic merged into scheduleNextDetection

// Start realtime detection
const startRealtimeDetection = () => {
  console.log('=== startRealtimeDetection 被调用 ===', '当前上传器:', currentUploader.value)

  // Ensure detection is only started for the picgo uploader
  if (currentUploader.value !== 'picgo') {
    console.log('当前不是picgo上传器，跳过检测')
    return
  }

  // Clear existing timer
  if (detectionTimer.value) {
    clearTimeout(detectionTimer.value) // Use clearTimeout
    detectionTimer.value = null
  }

  console.log('开始启动PicGo检测流程...')

  // Check if a previous detection result exists; if so, show the status indicator first
  if (picgoDetectionStatus.value && (picgoExists.value || picgoDetectionFailed.value)) {
    console.log('发现之前的检测结果，立即显示状态指示器')
    showStatusIndicator.value = true
    showInitialButton.value = false
    showLoadingAnimation.value = false
    showRefreshButton.value = false
    animationActive.value = false

    // Start the new detection flow after 1 second
    detectionTimer.value = setTimeout(() => {
      console.log('开始新的检测流程...')
      startLoadingAnimation()

      // Execute detection after 3 seconds
      detectionTimer.value = setTimeout(() => {
        console.log('执行PicGo检测...')
        testPicgo()
          .then(() => {
            scheduleNextDetection() // Begin normal scheduling after the first detection completes
          })
          .catch((error) => {
            console.error('初始PicGo检测失败:', error)
            scheduleNextDetection()
          })
      }, 3000)
    }, 1000)
  } else {
    // No previous detection result: immediately start the loading animation and timer
    startLoadingAnimation()

    // Execute the first detection after 3 seconds
    detectionTimer.value = setTimeout(() => {
      console.log('执行PicGo检测...')
      testPicgo()
        .then(() => {
          scheduleNextDetection() // Begin normal scheduling after the first detection completes
        })
        .catch((error) => {
          console.error('初始PicGo检测失败:', error)
          scheduleNextDetection()
        })
    }, 3000)
  }

  // Set up dynamic interval detection
  const scheduleNextDetection = () => {
    if (detectionTimer.value) {
      clearTimeout(detectionTimer.value)
    }

    // Adjust detection interval based on consecutive failures and page visibility
    const baseInterval = 30000 // 30-second base interval
    const maxInterval = 300000 // Maximum 5-minute interval
    let interval = Math.min(baseInterval * Math.pow(2, consecutiveFailures.value), maxInterval)

    // If the page is not visible, use a longer detection interval
    if (!isPageVisible.value) {
      interval = Math.max(interval * 2, 60000) // Check at least once per minute when page is hidden
    }

    console.log(
      `下次检测将在 ${interval / 1000} 秒后进行，连续失败次数: ${consecutiveFailures.value}`
    )

    detectionTimer.value = setTimeout(() => {
      if (!isDetecting.value && isPageVisible.value) {
        testPicgo()
          .then(() => {
            scheduleNextDetection() // Recursively schedule the next detection
          })
          .catch((error) => {
            console.error('PicGo检测异常:', error)
            scheduleNextDetection()
          })
      } else {
        scheduleNextDetection() // If detecting or page not visible, schedule directly
      }
    }, interval)
  }
}

// Stop realtime detection
const stopRealtimeDetection = () => {
  console.log('停止实时检测')
  if (detectionTimer.value) {
    clearTimeout(detectionTimer.value) // Use clearTimeout instead of clearInterval because we use setTimeout
    detectionTimer.value = null
  }
}

// lifecycle
// Page visibility change handler
const handleVisibilityChange = () => {
  isPageVisible.value = !document.hidden

  if (isPageVisible.value) {
    // When the page becomes visible, restart detection only if picgo is selected
    if (currentUploader.value === 'picgo') {
      console.log('页面变为可见且当前选择picgo，重新启动检测')
      startRealtimeDetection()
    }
  } else {
    // When the page is hidden, stop detection to save resources
    stopRealtimeDetection()
  }
}

// Component activation handler (for in-app page switches)
const handleComponentActivated = () => {
  console.log('=== handleComponentActivated 触发 ===', 'currentUploader:', currentUploader.value)
  isPageVisible.value = true

  // Only start detection if picgo is currently selected
  if (currentUploader.value === 'picgo') {
    console.log('当前选择picgo，重新启动检测')
    // Ensure previous state is cleaned up to avoid duplicate detection flows
    stopRealtimeDetection()
    stopAnimationAndButton()
    // Force a new detection flow to ensure the UI state is displayed correctly
    setTimeout(() => {
      if (currentUploader.value === 'picgo' && isPageVisible.value) {
        console.log('强制启动检测流程')
        startRealtimeDetection()
      }
    }, 50) // Very short delay to ensure state cleanup is complete
  }
}

// Component deactivation handler
const handleComponentDeactivated = () => {
  console.log('组件被失活，停止检测')
  isPageVisible.value = false
  stopRealtimeDetection()
}

onMounted(() => {
  console.log('=== onMounted 触发 ===', 'currentUploader:', currentUploader.value)
  nextTick(() => {
    if (imageBed.value.github) {
      Object.assign(github, imageBed.value.github)
    }
    githubToken.value = prefGithubToken.value
    cliScript.value = prefCliScript.value

    // Core detection startup logic — ensure it starts on onMounted
    if (currentUploader.value === 'picgo') {
      console.log('onMounted: 检测到picgo，强制启动检测流程')
      // Ensure UI state is clean
      stopRealtimeDetection()
      stopAnimationAndButton()
      // Start detection immediately
      setTimeout(() => {
        if (currentUploader.value === 'picgo') {
          console.log('onMounted: 执行检测启动')
          startRealtimeDetection()
        }
      }, 200) // Slightly longer delay to ensure state is fully initialized
    }

    if (Object.prototype.hasOwnProperty.call(uploadServices, currentUploader.value)) {
      // `getServices()` returns a new object each call (see services.ts), so
      // mutating its result would only update a throwaway instance. Use the
      // cached `uploadServices` singleton that the checkbox is bound to.
      uploadServices[currentUploader.value as UploaderServiceId].agreedToLegalNotices = true
    }

    // Extra safety mechanism: check again whether detection needs to start
    nextTick(() => {
      setTimeout(() => {
        if (
          currentUploader.value === 'picgo' &&
          !showLoadingAnimation.value &&
          !showStatusIndicator.value &&
          !showRefreshButton.value
        ) {
          console.log('onMounted: 保障机制 - 检测到picgo但没有显示任何状态，强制启动')
          startRealtimeDetection()
        }
      }, 500)
    })
  })

  // Listen for page visibility changes
  document.addEventListener('visibilitychange', handleVisibilityChange)
})

// Component activated (for in-app page switches)
onActivated(() => {
  console.log('=== onActivated 触发 ===')
  handleComponentActivated()

  // Extra safety mechanism: ensure the detection state is displayed correctly
  setTimeout(() => {
    if (
      currentUploader.value === 'picgo' &&
      !showLoadingAnimation.value &&
      !showStatusIndicator.value &&
      !showRefreshButton.value &&
      !showInitialButton.value
    ) {
      console.log('onActivated: 保障机制 - 检测到picgo但没有显示任何状态，强制启动')
      startRealtimeDetection()
    }
  }, 300)
})

// Component deactivated
onDeactivated(() => {
  handleComponentDeactivated()
})

// Clean up timers when component is unmounted
onUnmounted(() => {
  stopRealtimeDetection()

  // Stop animation and clean up timers
  stopAnimationAndButton()

  // Remove page visibility listener
  document.removeEventListener('visibilitychange', handleVisibilityChange)
})

// methods
const isValidUploaderService = (name: string): boolean => {
  return isValidService(name)
}

const getServiceNameById = (id: string): string => {
  const services = getServices()
  if (Object.prototype.hasOwnProperty.call(services, id)) {
    return services[id as UploaderServiceId].name
  }
  return id
}

const open = (link: string): void => {
  window.electron.shell.openExternal(link)
}

const save = (type: string): void => {
  if (!validate(type)) {
    return
  }

  const newImageBedConfig = JSON.parse(JSON.stringify(imageBed.value)) as Record<string, unknown>
  if (type === 'github') {
    newImageBedConfig.github = { ...github }
  } else if (type === 'cliScript') {
    newImageBedConfig.cliScript = cliScript.value
  }

  preferenceStore.SET_USER_DATA({
    type: 'imageBed',
    value: newImageBedConfig
  })
  if (type === 'github') {
    preferenceStore.SET_USER_DATA({
      type: 'githubToken',
      value: githubToken.value
    })
  }
  if (type === 'cliScript') {
    preferenceStore.SET_USER_DATA({
      type: 'cliScript',
      value: cliScript.value
    })
  }
  notice.notify({
    title: t('preferences.image.uploader.saveConfig'),
    message:
      type === 'github'
        ? t('preferences.image.uploader.githubConfigSaved')
        : t('preferences.image.uploader.scriptConfigSaved'),
    type: 'primary'
  })
}

const setCurrentUploader = (value: string | number | boolean): void => {
  const type = 'currentUploader'
  preferenceStore.SET_USER_DATA({ type, value })
}

// Manually trigger detection (retained for debugging)
const manualDetection = async (): Promise<void> => {
  if (isDetecting.value) return

  // Hide the standalone refresh button for 0.5 seconds
  showStandaloneRefreshButton.value = false

  // Re-show the button and start detection after 0.5 seconds
  setTimeout(() => {
    showStandaloneRefreshButton.value = true

    isDetecting.value = true
    // Start loading animation
    startLoadingAnimation()

    testPicgo().finally(() => {
      isDetecting.value = false
    })
  }, 500)
}

const formatDetectionTime = (time: string | null | undefined): string => {
  if (!time) return t('preferences.image.uploader.neverDetected')
  const date = new Date(time)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

const getLastSuccessTime = (): string => {
  return lastSuccessTime.value
    ? formatDetectionTime(lastSuccessTime.value)
    : t('preferences.image.uploader.neverSuccessful')
}

// Get status indicator CSS class
const getStatusIndicatorClass = (): string => {
  if (picgoDetectionFailed.value) {
    return 'status-error'
  } else if (picgoExists.value) {
    return 'status-success'
  } else {
    return 'status-not-found'
  }
}

// Start loading animation
const startLoadingAnimation = () => {
  console.log('=== startLoadingAnimation 被调用 ===')

  // Clear previous timers
  if (animationTimer.value) {
    clearInterval(animationTimer.value)
  }
  if (buttonTimer.value) {
    clearTimeout(buttonTimer.value)
  }
  if (initialButtonTimer.value) {
    clearTimeout(initialButtonTimer.value)
  }

  // Reset all state, then immediately show the loading animation instead of the initial button
  showStatusIndicator.value = false
  showInitialButton.value = false
  showRefreshButton.value = false
  animationActive.value = false
  showLoadingAnimation.value = true

  console.log('startLoadingAnimation: 初始状态设置完成:', {
    showInitialButton: showInitialButton.value,
    showLoadingAnimation: showLoadingAnimation.value,
    showRefreshButton: showRefreshButton.value,
    showStatusIndicator: showStatusIndicator.value,
    animationActive: animationActive.value
  })

  // Immediately start the animation timer without delay
  animationTimer.value = setInterval(() => {
    animationActive.value = !animationActive.value
    console.log('startLoadingAnimation: 动画闪烁:', animationActive.value)
  }, 1000)

  // Show the refresh button after 6 seconds (3s detection time + 3s extra wait)
  buttonTimer.value = setTimeout(() => {
    console.log('startLoadingAnimation: 显示刷新按钮')
    showLoadingAnimation.value = false
    showRefreshButton.value = true
    if (animationTimer.value) {
      clearInterval(animationTimer.value)
      animationTimer.value = null
    }
  }, 6000)
}

// Stop animation and hide buttons
const stopAnimationAndButton = () => {
  console.log('停止动画和按钮')
  showInitialButton.value = false
  showLoadingAnimation.value = false
  showRefreshButton.value = false
  showStatusIndicator.value = true
  animationActive.value = false

  console.log('停止后状态:', {
    showInitialButton: showInitialButton.value,
    showLoadingAnimation: showLoadingAnimation.value,
    showRefreshButton: showRefreshButton.value,
    showStatusIndicator: showStatusIndicator.value,
    animationActive: animationActive.value
  })

  // Clear all timers
  if (animationTimer.value) {
    clearInterval(animationTimer.value)
    animationTimer.value = null
  }
  if (buttonTimer.value) {
    clearTimeout(buttonTimer.value)
    buttonTimer.value = null
  }
  if (initialButtonTimer.value) {
    clearTimeout(initialButtonTimer.value)
    initialButtonTimer.value = null
  }
}

const testPicgo = async (): Promise<void> => {
  console.log('=== PicGo 检测开始 ===')

  console.log('window.commandExists:', window.commandExists)

  // Record detection start time
  lastDetectionTime.value = new Date().toISOString()

  const debugMessages: string[] = []
  debugMessages.push(`检测时间: ${new Date().toLocaleString()}`)

  // Add environment information
  debugMessages.push(`平台: ${window.process?.platform || 'unknown'}`)
  debugMessages.push('进程类型: renderer')

  if (typeof window.commandExists === 'undefined') {
    const errorMsg = 'commandExists 未暴露到 window 对象'
    console.error('✗', errorMsg)
    debugMessages.push(`✗ ${errorMsg}`)
    debugMessages.push('检查 preload 脚本是否正确加载')
    picgoExists.value = false
    picgoDetectionFailed.value = true
    picgoDetectionStatus.value = t('preferences.image.uploader.picgoDetectionFailed')
    picgoDebugInfo.value = debugMessages.join('\n')
    stopAnimationAndButton()
    return
  }

  debugMessages.push('✓ commandExists 已暴露到 window 对象')

  if (typeof window.commandExists.exists !== 'function') {
    const errorMsg = 'commandExists.exists 方法不可用'
    const availableKeys = Object.keys(window.commandExists).join(', ')
    console.error('✗', errorMsg)
    console.log('commandExists 对象内容:', availableKeys)
    debugMessages.push(`✗ ${errorMsg}`)
    debugMessages.push(`可用方法: ${availableKeys}`)
    picgoExists.value = false
    picgoDetectionFailed.value = true
    picgoDetectionStatus.value = t('preferences.image.uploader.picgoDetectionFailed')
    picgoDebugInfo.value = debugMessages.join('\n')
    stopAnimationAndButton()
    return
  }

  debugMessages.push('✓ commandExists.exists 方法可用')

  try {
    console.log('正在检测 PicGo...')
    debugMessages.push('正在检测 PicGo 命令...')

    // First test some basic commands
    const nodeExists = await window.commandExists.exists('node')
    const npmExists = await window.commandExists.exists('npm')
    debugMessages.push(`Node.js 检测: ${nodeExists ? '✓' : '✗'}`)
    debugMessages.push(`npm 检测: ${npmExists ? '✓' : '✗'}`)

    const result = await window.commandExists.exists('picgo')
    console.log('PicGo 检测结果:', result)
    debugMessages.push(`PicGo 检测结果: ${result}`)

    picgoExists.value = result

    if (result) {
      debugMessages.push('✓ PicGo 命令检测成功')
      picgoDetectionFailed.value = false
      picgoDetectionStatus.value = t('preferences.image.uploader.picgoInstalled')
      // Record the successful detection time
      lastSuccessTime.value = new Date().toISOString()
      consecutiveFailures.value = 0 // Reset failure count
    } else {
      debugMessages.push('✗ PicGo 命令未找到')
      debugMessages.push('可能原因:')
      debugMessages.push('1. PicGo 未安装')
      debugMessages.push('2. PATH 环境变量问题')
      debugMessages.push('3. Electron 环境限制')
      picgoDetectionFailed.value = false // Detection succeeded; PicGo is simply not installed
      picgoDetectionStatus.value = t('preferences.image.uploader.picgoNotInstalled')
    }
  } catch (error) {
    console.error('PicGo 检测失败:', error)
    const message = error instanceof Error ? error.message : String(error)
    const stack = error instanceof Error ? error.stack : undefined
    debugMessages.push(`✗ 检测异常: ${message}`)
    if (stack) {
      debugMessages.push(`错误堆栈: ${stack}`)
    }
    picgoExists.value = false
    picgoDetectionFailed.value = true
    picgoDetectionStatus.value = t('preferences.image.uploader.picgoDetectionFailed')
    consecutiveFailures.value++ // Increment failure count
  }

  picgoDebugInfo.value = debugMessages.join('\n')
  console.log('=== PicGo 检测结束 ===')
  console.log('调试信息:', debugMessages.join('\n'))

  // Stop animation after detection completes
  stopAnimationAndButton()
}

const validate = (value: string): boolean => {
  const services = getServices()
  if (!Object.prototype.hasOwnProperty.call(services, value)) return true
  const service = services[value as UploaderServiceId]
  const { agreedToLegalNotices } = service
  if (agreedToLegalNotices === false) {
    legalNoticesErrorStates[value] = true
    return false
  }
  if (legalNoticesErrorStates[value] !== undefined) {
    legalNoticesErrorStates[value] = false
  }

  return true
}
</script>

<style scoped>
.pref-image-uploader {
  color: var(--editorColor);
  font-size: 14px;
}

.pref-image-uploader .current-uploader {
  margin: 20px 0;
}

.pref-image-uploader .warning {
  color: var(--deleteColor);
}

.pref-image-uploader .link {
  color: var(--themeColor);
  cursor: pointer;
}

.pref-image-uploader .detection-status {
  margin: 15px 0;
  padding: 15px;
  border: 1px solid var(--editorColor30);
  border-radius: 6px;
  background: var(--floatBgColor);
}

.pref-image-uploader .detection-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.pref-image-uploader .detection-status h6 {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  color: var(--editorColor);
}

.pref-image-uploader .retest-button {
  font-size: 12px;
  padding: 4px 8px;
}

.pref-image-uploader .status-info {
  padding: 8px 12px;
  border-radius: 4px;
  margin-bottom: 10px;
  font-weight: 500;
}

.pref-image-uploader .status-info.success {
  background: var(--successBgColor, #f0f9ff);
  color: var(--successColor, #059669);
  border: 1px solid var(--successColor, #059669);
}

.pref-image-uploader .status-info.warning {
  background: var(--warningBgColor, #fffbeb);
  color: var(--warningColor, #d97706);
  border: 1px solid var(--warningColor, #d97706);
}

.pref-image-uploader .status-text {
  font-weight: 500;
  margin-bottom: 4px;
}

.pref-image-uploader .detection-time {
  font-size: 12px;
  opacity: 0.7;
  font-weight: normal;
}

.pref-image-uploader .detection-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pref-image-uploader .standalone-refresh-button {
  background: none;
  border: 1px solid var(--editorColor30, #ddd);
  cursor: pointer;
  padding: 6px 8px;
  border-radius: 4px;
  color: var(--editorColor70, #666);
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  min-width: 28px;
  height: 28px;
}

.pref-image-uploader .standalone-refresh-button:hover {
  background-color: var(--editorColor10, #f0f0f0);
  color: var(--themeColor, #007acc);
  border-color: var(--themeColor, #007acc);
}

.pref-image-uploader .standalone-refresh-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.pref-image-uploader .standalone-refresh-button:disabled:hover {
  background: none;
  color: var(--editorColor70, #666);
  border-color: var(--editorColor30, #ddd);
}

.pref-image-uploader .detection-status-indicator {
  display: flex;
  align-items: center;
  gap: 10px;
}

.pref-image-uploader .detection-animation-container {
  display: flex;
  align-items: center;
  margin-left: 8px;
}

.pref-image-uploader .loading-dot {
  width: 8px;
  height: 8px;
  background-color: var(--themeColor, #007acc);
  border-radius: 50%;
  opacity: 0.3;
  transition: opacity 0.3s ease;
}

.pref-image-uploader .loading-dot.animate {
  opacity: 1;
}

.pref-image-uploader .refresh-button {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  border-radius: 3px;
  color: var(--editorColor70, #666);
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.pref-image-uploader .refresh-button:hover {
  background-color: var(--editorColor10, #f0f0f0);
  color: var(--themeColor, #007acc);
}

.pref-image-uploader .refresh-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.pref-image-uploader .refresh-button:disabled:hover {
  background: none;
  color: var(--editorColor70, #666);
}

.pref-image-uploader .initial-button {
  background: none;
  border: none;
  cursor: default;
  padding: 4px;
  border-radius: 3px;
  color: var(--editorColor70, #666);
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.pref-image-uploader .initial-button:hover {
  background-color: var(--editorColor10, #f0f0f0);
  color: var(--themeColor, #007acc);
}

.pref-image-uploader .status-indicator {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  border-radius: 3px;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.pref-image-uploader .status-indicator.status-success {
  color: var(--successColor, #059669);
}

.pref-image-uploader .status-indicator.status-error {
  color: var(--deleteColor, #dc3545);
}

.pref-image-uploader .status-indicator.status-not-found {
  color: var(--editorColor70, #666);
}

.pref-image-uploader .status-indicator:hover {
  background-color: var(--editorColor10, #f0f0f0);
}

.pref-image-uploader .success-time {
  font-size: 12px;
  opacity: 0.7;
  font-weight: normal;
  color: var(--successColor, #059669);
}

.pref-image-uploader .detection-status-indicator {
  font-size: 12px;
  font-weight: 500;
}

.pref-image-uploader .detecting-indicator {
  color: var(--themeColor);
  animation: pulse 1.5s ease-in-out infinite;
}

.pref-image-uploader .auto-detection-info {
  color: var(--editorColor70);
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.pref-image-uploader .install-commands {
  margin-top: 12px;
  padding: 12px;
  background-color: var(--floatBgColor);
  border-radius: 6px;
  border-left: 4px solid var(--warningColor, #ffc107);
}

.pref-image-uploader .install-title {
  font-weight: 500;
  margin-bottom: 8px;
  color: var(--editorColor);
  font-size: 13px;
}

.pref-image-uploader .install-options {
  margin-bottom: 12px;
}

.pref-image-uploader .install-option {
  margin-bottom: 6px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.pref-image-uploader .install-option strong {
  min-width: 50px;
  font-size: 12px;
  color: var(--editorColor70);
}

.pref-image-uploader .install-command {
  background-color: var(--editorColor10);
  padding: 2px 6px;
  border-radius: 3px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 11px;
  color: var(--editorColor);
  border: 1px solid var(--editorColor20);
  user-select: all;
}

.pref-image-uploader .install-link {
  margin: 10px 0;
  font-size: 13px;
}

.pref-image-uploader .usage-guide {
  margin-top: 15px;
  padding: 15px;
  background-color: var(--floatBgColor);
  border-radius: 6px;
  border-left: 4px solid var(--themeColor);
}

.pref-image-uploader .usage-title {
  font-weight: 500;
  margin-bottom: 12px;
  color: var(--editorColor);
  font-size: 14px;
}

.pref-image-uploader .usage-content {
  margin-bottom: 12px;
}

.pref-image-uploader .usage-step {
  margin-bottom: 12px;
  padding: 8px 0;
}

.pref-image-uploader .usage-step strong {
  color: var(--editorColor);
  font-size: 13px;
  display: block;
  margin-bottom: 4px;
}

.pref-image-uploader .usage-description {
  font-size: 12px;
  color: var(--editorColor70);
  margin-bottom: 6px;
  line-height: 1.4;
}

.pref-image-uploader .usage-command {
  background-color: var(--editorColor10);
  padding: 4px 8px;
  border-radius: 3px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 11px;
  color: var(--editorColor);
  border: 1px solid var(--editorColor20);
  user-select: all;
  display: inline-block;
}

.pref-image-uploader .usage-link {
  margin-top: 8px;
  font-size: 13px;
}

.pref-image-uploader .debug-info {
  margin-top: 15px;
}

.pref-image-uploader .debug-info summary {
  cursor: pointer;
  font-size: 13px;
  color: var(--editorColor70);
  margin-bottom: 8px;
}

.pref-image-uploader .debug-info pre {
  background: var(--codeBgColor, #f8f9fa);
  border: 1px solid var(--editorColor20);
  border-radius: 4px;
  padding: 10px;
  font-size: 12px;
  line-height: 1.4;
  color: var(--editorColor);
  white-space: pre-wrap;
  word-wrap: break-word;
  max-height: 200px;
  overflow-y: auto;
}

.pref-image-uploader .description {
  margin-top: 20px;
  margin-bottom: 20px;
}

.pref-image-uploader .form-group {
  margin: 20px 0 0 0;
}

.pref-image-uploader .label {
  margin-bottom: 10px;
}

.pref-image-uploader .el-input__inner {
  background: transparent;
}

.pref-image-uploader .el-button.btn-reset,
.pref-image-uploader .button-group {
  margin-top: 30px;
}

.pref-image-uploader .pref-cb-legal-notices.github {
  margin-top: 30px;
}

.pref-image-uploader .pref-cb-legal-notices.error {
  border: 1px solid var(--deleteColor);
}
</style>
