<template>
  <div class="terminal-panel">
    <div
      class="term-handle"
      :class="{ open: showTerminalPanel }"
      role="separator"
      aria-orientation="horizontal"
      :aria-label="t('terminal.height')"
      @mousedown="onDragStart"
    />
    <section
      v-show="showTerminalPanel"
      class="terminal"
      :style="{ height: `${renderedHeight}px` }"
      :aria-label="t('terminal.title')"
    >
      <div class="term-tabs">
        <span class="term-tab">{{ t('terminal.title') }}</span>
        <button
          type="button"
          class="term-collapse"
          :aria-label="t('terminal.collapseButton')"
          @click="collapse"
        >
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      </div>
      <div
        class="term-body"
        :aria-label="t('terminal.screen')"
      />
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { clampTerminalHeight, TERMINAL_COLLAPSE_BELOW } from '@/agent/chrome/fit'
import { useLayoutStore } from '@/store/layout'

const { t } = useI18n()
const layoutStore = useLayoutStore()
const { showTerminalPanel, terminalPanelHeight, viewportHeight } = storeToRefs(layoutStore)

const renderedHeight = computed(() =>
  clampTerminalHeight(terminalPanelHeight.value, viewportHeight.value || 768)
)

const collapse = (): void => {
  layoutStore.TOGGLE_LAYOUT_ENTRY('showTerminalPanel')
  layoutStore.DISPATCH_LAYOUT_MENU_ITEMS()
}

const onDragStart = (event: MouseEvent): void => {
  if (event.button !== 0) return
  event.preventDefault()
  const origin = event.clientY
  const start = showTerminalPanel.value ? renderedHeight.value : 0

  const move = (ev: MouseEvent): void => {
    const next = start - (ev.clientY - origin)
    if (next < TERMINAL_COLLAPSE_BELOW) {
      if (showTerminalPanel.value) {
        layoutStore.SET_LAYOUT({ showTerminalPanel: false }, { scheduleBufferUpdate: false })
      }
      return
    }
    layoutStore.SET_LAYOUT({ showTerminalPanel: true }, { scheduleBufferUpdate: false })
    layoutStore.SET_TERMINAL_PANEL_HEIGHT(
      clampTerminalHeight(next, viewportHeight.value || 768),
      { scheduleBufferUpdate: false }
    )
  }
  const up = (): void => {
    document.removeEventListener('mousemove', move)
    document.removeEventListener('mouseup', up)
    layoutStore.SET_TERMINAL_PANEL_HEIGHT(terminalPanelHeight.value)
    layoutStore.DISPATCH_LAYOUT_MENU_ITEMS()
  }

  document.addEventListener('mousemove', move)
  document.addEventListener('mouseup', up)
}
</script>

<style scoped>
.terminal-panel {
  flex: none;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.term-handle {
  flex: none;
  height: 6px;
  cursor: ns-resize;
  position: relative;
  z-index: 2;
}

.term-handle::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  top: 2px;
  height: 2px;
  background: transparent;
}

.term-handle:hover::after,
.term-handle.open::after {
  background: var(--iconColor);
}

.terminal {
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: var(--editorBgColor);
  color: var(--editorColor);
  border-top: 1px solid var(--itemBgColor);
}

.term-tabs {
  height: 28px;
  flex: none;
  display: flex;
  align-items: center;
  background: var(--sideBarBgColor);
  user-select: none;
}

.term-tab {
  height: 28px;
  padding: 0 10px;
  display: flex;
  align-items: center;
  font-size: 12px;
  color: var(--sideBarTitleColor);
  box-shadow: inset 0 -2px 0 var(--themeColor);
}

.term-collapse {
  margin-left: auto;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: none;
  color: var(--sideBarIconColor);
  cursor: pointer;
}

.term-collapse svg {
  width: 14px;
  height: 14px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.75;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.term-collapse:focus-visible {
  outline: 1px solid var(--themeColor);
  outline-offset: -1px;
}

.term-body {
  flex: 1;
  min-height: 0;
}
</style>
