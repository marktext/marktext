<template>
  <section
    class="pref-setting-row"
    :class="{ 'ag-underdevelop': disabled, 'is-compact': compact, 'is-wide': wide }"
  >
    <div class="pref-setting-label">
      <div
        v-if="description"
        class="pref-setting-name"
      >
        <span>{{ description }}</span>
        <button
          v-if="more"
          type="button"
          class="plain-button pref-help-link"
          :aria-label="t('preferences.learnMore', { name: description })"
          @click="openHelp"
        >
          <LinkIcon :size="14" />
        </button>
      </div>
      <div
        v-if="notes"
        :id="notesId"
        class="notes"
      >
        {{ notes }}
      </div>
    </div>
    <div class="pref-setting-control">
      <slot :description-id="notes ? notesId : undefined" />
    </div>
  </section>
</template>

<script setup lang="ts">
import { useId } from 'vue'
import { useI18n } from 'vue-i18n'
import LinkIcon from '@/components/icons/LinkIcon.vue'
import type { PrefControlBaseProps } from './types'

const props = defineProps<PrefControlBaseProps & {
  disabled?: boolean
  compact?: boolean
}>()
const { t } = useI18n()
const notesId = `preference-note-${useId()}`
const openHelp = (): void => {
  if (props.more) window.electron.shell.openExternal(props.more)
}
</script>

<style>
.pref-setting-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(160px, 42%);
  align-items: start;
  gap: 12px 24px;
  margin: 16px 0;
  font-size: 14px;
  color: var(--editorColor);
}
.pref-setting-row.is-compact {
  grid-template-columns: minmax(0, 1fr) auto;
}
.pref-setting-name {
  display: flex;
  align-items: center;
  gap: 4px;
  min-height: 32px;
  line-height: 1.5;
}
.pref-help-link {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  color: var(--iconColor);
}
.pref-help-link:hover,
.pref-help-link:focus-visible {
  color: var(--themeColor);
}
.pref-setting-label,
.pref-setting-control {
  min-width: 0;
}
.pref-setting-control {
  align-self: start;
}
.pref-setting-control > .el-select,
.pref-setting-control > .el-input,
.pref-setting-control > .el-autocomplete {
  width: 100%;
}
.pref-setting-row .notes {
  margin-top: 4px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}
.pref-setting-row .el-input,
.pref-setting-row .el-select,
.pref-setting-row .el-autocomplete {
  --el-fill-color-blank: transparent;
  --el-input-bg-color: transparent;
  --el-border-color: var(--editorColor10);
  --el-text-color-regular: var(--editorColor);
  --el-text-color-placeholder: var(--editorColor30);
  --el-color-primary: var(--themeColor);
}
.pref-setting-row input.el-input__inner {
  background: transparent;
  border: none;
  color: var(--editorColor);
}
.pref-setting-row.is-wide .pref-setting-control {
  grid-column: 1 / -1;
}
@container (max-width: 480px) {
  .pref-setting-row:not(.is-compact) {
    grid-template-columns: minmax(0, 1fr);
    gap: 6px;
  }
}
</style>
