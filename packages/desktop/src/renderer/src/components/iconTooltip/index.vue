<template>
  <el-tooltip
    ref="tooltipRef"
    :content="content"
    :placement="placement"
    :trigger-keys="TRIGGER_KEYS"
    :show-after="HOVER_DELAY"
    :show-arrow="false"
    effect="light"
    popper-class="mt-icon-tooltip"
    @before-show="listenForEscape"
    @hide="stopListeningForEscape"
  >
    <slot />
  </el-tooltip>
</template>

<script setup lang="ts">
/**
 * Pointer tooltip only: callers must label the slotted button with aria-label.
 * Opening on keyboard focus would repeat the label through aria-describedby.
 * el-tooltip overwrites its trigger's aria-expanded/haspopup/controls; wrap menu
 * and disclosure buttons in a non-focusable span to preserve their state.
 */
import { ref, onBeforeUnmount } from 'vue'
import type { Placement, TooltipInstance } from 'element-plus'
import { isMac } from '@/util'

withDefaults(defineProps<{ content: string; placement?: Placement }>(), {
  placement: 'bottom'
})

// el-tooltip toggles itself on Enter/Space keydown and calls preventDefault,
// which would cancel the button's own click.
const TRIGGER_KEYS: string[] = []

// Match VS Code's platform-specific workbench hover timing, in milliseconds.
const HOVER_DELAY = isMac ? 1500 : 500

const tooltipRef = ref<TooltipInstance | null>(null)

// WCAG 1.4.13 asks that content shown on hover can be dismissed without moving
// the pointer; el-tooltip only handles Escape inside a focus trap. Listening
// from `before-show` covers the fade-in, which `show` only reports once done.
// The event is left to propagate so Escape still closes the surrounding panel.
const hideOnEscape = (event: KeyboardEvent): void => {
  if (event.key === 'Escape') tooltipRef.value?.hide()
}
const listenForEscape = (): void => document.addEventListener('keydown', hideOnEscape, true)
const stopListeningForEscape = (): void =>
  document.removeEventListener('keydown', hideOnEscape, true)

onBeforeUnmount(stopListeningForEscape)
</script>

<style>
/* The popper is teleported to body, outside the caller's scoped styles. */
.el-popper.is-light.mt-icon-tooltip {
  --icon-tooltip-text-tint: #000;
  padding: 4px 8px;
  border: 1px solid var(--floatBorderColor);
  border-radius: 3px;
  background: var(--floatBgColor);
  /* Strengthen muted theme text for these small labels. */
  color: color-mix(in srgb, var(--sideBarTitleColor) 75%, var(--icon-tooltip-text-tint));
  box-shadow: var(--floatShadow);
  font-size: 12px;
  line-height: 1.5;
}

body.dark .el-popper.mt-icon-tooltip {
  --icon-tooltip-text-tint: #fff;
}
</style>
