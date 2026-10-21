<template>
  <div>
    <div
      v-if="showTitleBar"
      class="title-bar-editor-bg"
      :class="{ 'tabs-visible': showTabBar }"
    />
    <div
      v-if="showTitleBar"
      class="title-bar"
      :class="[
        { active: active },
        { 'tabs-visible': showTabBar },
        { frameless: titleBarStyle === 'custom' },
        { isOsx: isOsx }
      ]"
    >
      <div
        class="title"
        @dblclick.stop="toggleMaxmizeOnMacOS"
      >
        <span v-if="!filename">MarkText</span>
        <span v-else>
          <span
            class="save-dot"
            :class="{ show: !isSaved }"
          />
          <span class="path">
            <bdi dir="ltr">
              <span
                v-for="(path, index) of paths"
                :key="index"
              >
                {{ path }}
                <el-icon
                  class="path-arrow"
                  :size="12"
                >
                  <ArrowRight />
                </el-icon>
              </span>
              <span
                class="filename"
                :class="{ isOsx: platform === 'darwin' }"
                @click="rename"
              >
                {{ filename }}
              </span>
            </bdi>
          </span>
        </span>
      </div>
      <div :class="showCustomTitleBar ? 'left-toolbar title-no-drag' : 'right-toolbar'">
        <button
          v-if="showCustomTitleBar"
          type="button"
          class="plain-button frameless-titlebar-menu title-no-drag"
          aria-haspopup="menu"
          :aria-label="t('titleBar.applicationMenu')"
          @click.stop="handleMenuClick"
        >
          <span class="text-center-vertical">&#9776;</span>
        </button>
        <document-statistics
          v-if="wordCount"
          :pathname="pathname"
          :word-count="wordCount"
          :selection-word-count="selectionWordCount"
          :is-saved="isSaved"
          :read-only="!!currentFile?.readOnly"
          :mode-changing="!!currentFile?.modeChanging"
          @toggle-reading="setReadingMode"
        />
      </div>
      <div
        v-if="titleBarStyle === 'custom' && !isFullScreen && !isOsx"
        class="right-toolbar window-controls"
        :class="[{ 'title-no-drag': titleBarStyle === 'custom' }]"
      >
        <icon-tooltip :content="t('titleBar.minimize')">
          <button
            type="button"
            class="plain-button frameless-titlebar-button frameless-titlebar-minimize"
            :aria-label="t('titleBar.minimize')"
            @click.stop="handleMinimizeClick"
          >
            <span>
              <svg
                width="10"
                height="10"
              >
                <path :d="windowIconMinimize" />
              </svg>
            </span>
          </button>
        </icon-tooltip>
        <icon-tooltip :content="maximizeLabel">
          <button
            type="button"
            class="plain-button frameless-titlebar-button frameless-titlebar-toggle"
            :aria-label="maximizeLabel"
            @click.stop="handleMaximizeClick"
          >
            <span>
              <svg
                width="10"
                height="10"
              >
                <path
                  v-show="!isMaximized"
                  :d="windowIconMaximize"
                />
                <path
                  v-show="isMaximized"
                  :d="windowIconRestore"
                />
              </svg>
            </span>
          </button>
        </icon-tooltip>
        <icon-tooltip
          :content="t('titleBar.close')"
          placement="bottom-end"
        >
          <button
            type="button"
            class="plain-button frameless-titlebar-button frameless-titlebar-close"
            :aria-label="t('titleBar.close')"
            @click.stop="handleCloseClick"
          >
            <span>
              <svg
                width="10"
                height="10"
              >
                <path :d="windowIconClose" />
              </svg>
            </span>
          </button>
        </icon-tooltip>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { usePreferencesStore } from '@/store/preferences.js'
import { useLayoutStore } from '@/store/layout.js'
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { storeToRefs } from 'pinia'
import { minimizePath, restorePath, maximizePath, closePath } from '../../assets/window-controls.js'
import { PATH_SEPARATOR } from '../../config'
import { isMac as isOsxPlatform } from '@/util'
import { shouldShowInAppTitleBar } from './visibility'
import { pathBreadcrumb } from './pathBreadcrumb'
import { buildWindowTitle } from './windowTitle'
import { useEditorStore } from '@/store/editor'
import { useI18n } from 'vue-i18n'
import { ArrowRight } from '@element-plus/icons-vue'
import IconTooltip from '@/components/iconTooltip/index.vue'
import DocumentStatistics from './documentStatistics.vue'
import type { FileWordCount } from '@shared/types/files'

interface ProjectInfo {
  name?: string
  [key: string]: unknown
}

const props = defineProps<{
  project?: ProjectInfo | null
  filename?: string
  pathname?: string
  active?: boolean
  wordCount?: FileWordCount | null
  selectionWordCount?: FileWordCount | null
  platform?: string
  isSaved?: boolean
}>()

const preferencesStore = usePreferencesStore()
const layoutStore = useLayoutStore()
const editorStore = useEditorStore()
const { currentFile } = storeToRefs(editorStore)
const setReadingMode = (readOnly: boolean): void => {
  if (currentFile.value) void editorStore.SET_READ_ONLY(currentFile.value.id, readOnly)
}
const { t } = useI18n()

const isOsx = isOsxPlatform
const windowIconMinimize = minimizePath
const windowIconRestore = restorePath
const windowIconMaximize = maximizePath
const windowIconClose = closePath

const isFullScreen = ref(false)
const isMaximized = ref(false)

onMounted(async () => {
  try {
    const [fs, max] = await Promise.all([
      window.electron.windowControl.isFullScreen(),
      window.electron.windowControl.isMaximized()
    ])
    isFullScreen.value = !!fs
    isMaximized.value = !!max
  } catch {
    // Window state is best-effort; keep the previous values if the query fails.
  }
})

const { titleBarStyle } = storeToRefs(preferencesStore)
const { showTabBar } = storeToRefs(layoutStore)

const paths = computed(() => pathBreadcrumb(props.pathname ?? '', PATH_SEPARATOR))

const showCustomTitleBar = computed(() => {
  return titleBarStyle.value === 'custom' && !isOsx
})

const showTitleBar = computed(() => {
  return shouldShowInAppTitleBar(titleBarStyle.value, isOsx)
})

const maximizeLabel = computed(() =>
  isMaximized.value ? t('titleBar.restore') : t('titleBar.maximize')
)

watch(
  () => props.filename,
  (value) => {
    document.title = buildWindowTitle(value, props.project?.name ?? '', isOsx)
  }
)

const handleCloseClick = () => {
  window.electron.windowControl.close()
}

const handleMaximizeClick = async () => {
  if (isFullScreen.value) {
    window.electron.windowControl.setFullScreen(false)
    return
  }
  if (isMaximized.value) window.electron.windowControl.unmaximize()
  else window.electron.windowControl.maximize()
}

const toggleMaxmizeOnMacOS = () => {
  if (isOsx) {
    handleMaximizeClick()
  }
}

const handleMinimizeClick = () => {
  window.electron.windowControl.minimize()
}

const handleMenuClick = () => {
  window.electron.windowControl.popupApplicationMenu({ x: 23, y: 20 })
}

const rename = () => {
  if (props.platform === 'darwin') {
    editorStore.RESPONSE_FOR_RENAME()
  }
}

const onMaximize = () => {
  isMaximized.value = true
}
const onUnmaximize = () => {
  isMaximized.value = false
}
const onEnterFullScreen = () => {
  isFullScreen.value = true
}
const onLeaveFullScreen = () => {
  isFullScreen.value = false
}

const offMaximize = window.electron.ipcRenderer.on('mt::window-maximize', onMaximize)
const offUnmaximize = window.electron.ipcRenderer.on('mt::window-unmaximize', onUnmaximize)
const offEnterFullScreen = window.electron.ipcRenderer.on(
  'mt::window-enter-full-screen',
  onEnterFullScreen
)
const offLeaveFullScreen = window.electron.ipcRenderer.on(
  'mt::window-leave-full-screen',
  onLeaveFullScreen
)

onBeforeUnmount(() => {
  offMaximize()
  offUnmaximize()
  offEnterFullScreen()
  offLeaveFullScreen()
})
</script>

<style scoped>
.title-bar-editor-bg {
  height: var(--titleBarHeight);
  background: var(--editorBgColor);
  position: relative;
  left: 0;
  top: 0;
  right: 0;
}
.title-bar {
  -webkit-app-region: drag;
  user-select: none;
  background: transparent;
  height: var(--titleBarHeight);
  box-sizing: border-box;
  color: var(--editorColor50);
  position: fixed;
  left: 0;
  top: 0;
  right: 0;
  z-index: 2;
  transition: color 0.4s ease-in-out;
  cursor: default;
}
.active {
  color: var(--editorColor);
}
img {
  height: 90%;
  margin-top: 1px;
  vertical-align: top;
}
.title {
  padding: 0 190px;
  height: 100%;
  line-height: var(--titleBarHeight);
  font-size: 14px;
  text-align: center;
  transition: all 0.25s ease-in-out;
  & .filename {
    transition: all 0.25s ease-in-out;
  }
  &::after {
    content: '';
    position: absolute;
    top: 0;
    height: 1px;
    width: 100%;
    z-index: 1;
    -webkit-app-region: no-drag;
  }
}
div.title > span {
  display: flex;
  align-items: baseline;
  justify-content: center;
}

/* Workaround for GH#339: the RTL context clips an over-long path from the left
   so the filename stays visible. The save dot is a sibling rather than a child
   so that clipping can never swallow it. */
div.title > span > .path {
  direction: rtl;
  overflow: hidden;
  text-overflow: clip;
  white-space: nowrap;
  min-width: 0;
}

/* The RTL context above only exists to clip long paths from the left. Isolating
   each segment keeps an RTL folder name from dragging its separator — or the
   segments around it — out of order. */
div.title > span > .path > bdi > span {
  unicode-bidi: isolate;
}

.title-bar .title .filename.isOsx:hover {
  color: var(--themeColor);
}

.active .save-dot {
  flex: none;
  margin-right: 0.25rem;
  width: 8px;
  height: 8px;
  display: inline-block;
  border-radius: 50%;
  background: var(--highlightThemeColor);
  opacity: 0.7;
  visibility: hidden;
}
.active .save-dot.show {
  visibility: visible;
}
.title:hover {
  color: var(sideBarTitleColor);
}

.left-toolbar {
  padding: 0 10px;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
  width: 190px;
  display: flex;
  flex-direction: row;
}
.right-toolbar {
  height: 100%;
  position: absolute;
  top: 0;
  right: 0;
  width: 190px;
  display: flex;
  align-items: center;
  flex-direction: row-reverse;
  & .item {
    margin-right: 10px;
  }
}

.title-no-drag {
  -webkit-app-region: no-drag;
}
/* frameless window controls */
.frameless-titlebar-button {
  position: relative;
  display: block;
  width: 46px;
  height: var(--titleBarHeight);
}
/* `.right-toolbar` lays its items out in reverse. The window controls are
   listed minimize → close and laid out forwards, so Tab moves left to right. */
.window-controls {
  width: 138px;
  flex-direction: row;
}
.frameless-titlebar-button > span {
  position: absolute;
  display: inline-flex;
  top: 50%;
  left: 50%;
  transform: translateX(-50%) translateY(-50%);
}
.frameless-titlebar-menu {
  color: var(--sideBarColor);
}
.frameless-titlebar-close:hover {
  background-color: rgb(228, 79, 79);
}
.frameless-titlebar-minimize:hover,
.frameless-titlebar-toggle:hover {
  background-color: rgba(0, 0, 0, 0.1);
}
.frameless-titlebar-button svg {
  fill: #000000;
}
.frameless-titlebar-close:hover svg {
  fill: #ffffff;
}

.text-center-vertical {
  display: inline-block;
  vertical-align: middle;
  line-height: normal;
}
</style>
