<template>
  <section
    class="pref-check-list"
    :class="{ 'ag-underdevelop': disable }"
  >
    <div class="options">
      <el-checkbox
        v-for="option in options"
        :key="option.value"
        :model-value="isSelected(option.value)"
        :disabled="disable"
        @change="handleChange(option.value, $event)"
      >
        {{ option.label }}
      </el-checkbox>
      <LinkIcon
        v-if="more"
        :size="14"
        class="link-icon"
        @click="handleMoreClick"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import LinkIcon from '@/components/icons/LinkIcon.vue'
import type { PrefControlProps, PrefSelectOption } from '../types'

interface CheckListProps extends PrefControlProps<string[]> {
  options: ReadonlyArray<PrefSelectOption<string>>
}

const props = withDefaults(defineProps<CheckListProps>(), {
  more: '',
  disable: false
})

/**
 * `more` is part of the shared control props and every other control renders it
 * as a link to the related documentation, so this one does too — declaring it
 * and dropping it would leave the option silently doing nothing on this page.
 */
const handleMoreClick = () => {
  if (typeof props.more === 'string') {
    window.electron.shell.openExternal(props.more)
  }
}

/**
 * The value comes straight from the persisted preferences, so it is only an
 * array by convention: a hand-edited settings file would otherwise reach
 * `undefined.includes` and take the whole preferences page down.
 */
const isSelected = (item: string): boolean =>
  Array.isArray(props.value) && props.value.includes(item)

/**
 * Emit a fresh array instead of mutating `value`: the result is stored as a
 * preference, so the parent has to see a new value to persist.
 *
 * The order follows `options` rather than the click order, which keeps the
 * stored setting stable no matter how the user got there.
 */
const handleChange = (item: string, checked: boolean | string | number): void => {
  const selected = new Set(props.value)
  if (checked) {
    selected.add(item)
  } else {
    selected.delete(item)
  }
  props.onChange(props.options.map((option) => option.value).filter((v) => selected.has(v)))
}
</script>

<style>
.pref-check-list {
  font-size: 14px;
  user-select: none;
  color: var(--editorColor);

  & .link-icon {
    align-self: center;
    margin-left: 4px;
    cursor: pointer;
    opacity: 0.7;
    color: var(--iconColor);

    &:hover {
      color: var(--themeColor);
    }
  }

  /* Wrapped rather than stacked: the format list is seven short items and reads
     better as a grid than as a column that pushes the rest of the page down. */
  & .options {
    display: flex;
    flex-wrap: wrap;
    column-gap: 16px;
  }

  & .el-checkbox {
    height: 30px;
    margin-right: 0;
  }

  & .el-checkbox__label {
    font-size: 13px;
    color: var(--editorColor);
  }

  & .el-checkbox.is-disabled .el-checkbox__label {
    color: var(--editorColor50);
  }
}
</style>
