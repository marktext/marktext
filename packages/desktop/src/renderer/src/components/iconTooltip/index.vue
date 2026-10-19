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
 * Shows the label of an icon-only control when the pointer rests on it.
 *
 * The tooltip is for sighted users only and does not name the control: give
 * the slotted <button> an `aria-label` with the same text. The button stays in
 * the caller's template, so the caller's scoped styles still reach it.
 *
 * It does not open on keyboard focus: while open, el-tooltip points the
 * trigger's `aria-describedby` at it, so screen readers would read every label
 * twice. el-tooltip also overwrites `aria-expanded`, `aria-haspopup` and
 * `aria-controls` on the slotted element, so a disclosure or menu button cannot
 * be wrapped directly without losing its state; use a non-focusable span
 * around such a button to keep these attributes on the button.
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
