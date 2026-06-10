<template>
  <div
    class="formatting-toolbar"
    role="toolbar"
    :aria-label="t('menu.format.format')"
  >
    <div class="toolbar-group">
      <button
        type="button"
        class="toolbar-button icon-only"
        :title="t('menu.file.newTab')"
        :aria-label="t('menu.file.newTab')"
        @mousedown.prevent
        @click="executeCommand('file.new-tab')"
      >
        <FilePlusIcon class="toolbar-icon" />
      </button>
      <button
        type="button"
        class="toolbar-button icon-only"
        :title="t('menu.file.save')"
        :aria-label="t('menu.file.save')"
        @mousedown.prevent
        @click="executeCommand('file.save')"
      >
        <DocumentChecked class="toolbar-icon" />
      </button>
    </div>

    <div class="toolbar-group">
      <details
        class="toolbar-menu menu-title"
        :title="t('menu.paragraph.title')"
        @focusout="closeMenuOnFocusOut"
      >
        <summary
          class="toolbar-menu-trigger"
          :aria-label="t('menu.paragraph.title')"
        >
          T
        </summary>
        <div class="toolbar-menu-panel">
          <button
            v-for="option in headingOptions"
            :key="option.command"
            type="button"
            class="toolbar-menu-item"
            :disabled="isEditorCommandDisabled"
            @mousedown.prevent
            @click="executeMenuCommand(option.command, $event)"
          >
            {{ option.label }}
          </button>
        </div>
      </details>
    </div>

    <template
      v-for="group in groupsBeforeLists"
      :key="group.id"
    >
      <div class="toolbar-group">
        <button
          v-for="item in group.items"
          :key="item.command"
          type="button"
          class="toolbar-button"
          :class="[{ active: item.active }, { compact: item.compact }, { 'icon-only': item.icon }]"
          :title="item.title"
          :aria-label="item.title"
          :aria-pressed="item.active ? 'true' : 'false'"
          :disabled="item.disabled"
          @mousedown.prevent
          @click="executeCommand(item.command)"
        >
          <component
            :is="item.icon"
            v-if="item.icon"
            class="toolbar-icon"
          />
          <span
            v-else
            class="toolbar-label"
            :class="item.labelClass"
          >
            {{ item.label }}
          </span>
        </button>
      </div>
    </template>

    <div class="toolbar-group">
      <details
        class="toolbar-menu menu-list"
        :title="t('menu.paragraph.taskList')"
        @focusout="closeMenuOnFocusOut"
      >
        <summary
          class="toolbar-menu-trigger"
          :aria-label="t('menu.paragraph.taskList')"
        >
          {{ t('toolbar.list') }}
        </summary>
        <div class="toolbar-menu-panel">
          <button
            v-for="option in listOptions"
            :key="option.command"
            type="button"
            class="toolbar-menu-item"
            :disabled="isEditorCommandDisabled"
            @mousedown.prevent
            @click="executeMenuCommand(option.command, $event)"
          >
            {{ option.label }}
          </button>
        </div>
      </details>
    </div>

    <template
      v-for="group in groupsAfterLists"
      :key="group.id"
    >
      <div class="toolbar-group">
        <button
          v-for="item in group.items"
          :key="item.command"
          type="button"
          class="toolbar-button"
          :class="[{ active: item.active }, { compact: item.compact }, { 'icon-only': item.icon }]"
          :title="item.title"
          :aria-label="item.title"
          :aria-pressed="item.active ? 'true' : 'false'"
          :disabled="item.disabled"
          @mousedown.prevent
          @click="executeCommand(item.command)"
        >
          <component
            :is="item.icon"
            v-if="item.icon"
            class="toolbar-icon"
          />
          <span
            v-else
            class="toolbar-label"
            :class="item.labelClass"
          >
            {{ item.label }}
          </span>
        </button>
      </div>
    </template>

    <div class="toolbar-group">
      <details
        class="toolbar-menu menu-export"
        :title="t('menu.file.export')"
        @focusout="closeMenuOnFocusOut"
      >
        <summary
          class="toolbar-menu-trigger"
          :aria-label="t('menu.file.export')"
        >
          <Upload class="toolbar-icon" />
        </summary>
        <div class="toolbar-menu-panel align-right">
          <button
            v-for="option in exportOptions"
            :key="option.command"
            type="button"
            class="toolbar-menu-item"
            @mousedown.prevent
            @click="executeMenuCommand(option.command, $event)"
          >
            {{ option.label }}
          </button>
        </div>
      </details>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, h, type Component } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import {
  DocumentChecked,
  Grid,
  Link,
  Picture,
  PriceTag,
  Upload,
} from '@element-plus/icons-vue'
import bus from '@/bus'
import { useEditorStore } from '@/store/editor'

interface ToolbarItem {
  command: string
  label: string
  title: string
  icon?: Component
  labelClass?: string
  compact?: boolean
  active?: boolean
  disabled?: boolean
}

interface ToolbarGroup {
  id: string
  items: ToolbarItem[]
}

interface ToolbarMenuOption {
  command: string
  label: string
}

const FilePlusIcon: Component = {
  name: 'FilePlusIcon',
  render () {
    return h(
      'svg',
      {
        viewBox: '0 0 24 24',
        fill: 'none',
        xmlns: 'http://www.w3.org/2000/svg',
        'aria-hidden': 'true'
      },
      [
        h('path', {
          d: 'M6 3h8l4 4v14H6z',
          stroke: 'currentColor',
          'stroke-width': '1.8',
          'stroke-linejoin': 'round',
          'stroke-linecap': 'round'
        }),
        h('path', {
          d: 'M14 3v4h4',
          stroke: 'currentColor',
          'stroke-width': '1.8',
          'stroke-linejoin': 'round',
          'stroke-linecap': 'round'
        }),
        h('path', {
          d: 'M12 10v7',
          stroke: 'currentColor',
          'stroke-width': '1.8',
          'stroke-linejoin': 'round',
          'stroke-linecap': 'round'
        }),
        h('path', {
          d: 'M8.5 13.5h7',
          stroke: 'currentColor',
          'stroke-width': '1.8',
          'stroke-linejoin': 'round',
          'stroke-linecap': 'round'
        })
      ]
    )
  }
}

const UndoIcon: Component = {
  name: 'UndoIcon',
  render () {
    return h(
      'svg',
      {
        viewBox: '0 0 24 24',
        fill: 'none',
        xmlns: 'http://www.w3.org/2000/svg',
        'aria-hidden': 'true'
      },
      [
        h('path', {
          d: 'M10 6 6 9l4 3',
          stroke: 'currentColor',
          'stroke-width': '1.9',
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round'
        }),
        h('path', {
          d: 'M7 9h6.5a4.5 4.5 0 0 1 4.5 4.5V15',
          stroke: 'currentColor',
          'stroke-width': '1.9',
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round'
        })
      ]
    )
  }
}

const RedoIcon: Component = {
  name: 'RedoIcon',
  render () {
    return h(
      'svg',
      {
        viewBox: '0 0 24 24',
        fill: 'none',
        xmlns: 'http://www.w3.org/2000/svg',
        'aria-hidden': 'true'
      },
      [
        h('path', {
          d: 'M14 6l4 3-4 3',
          stroke: 'currentColor',
          'stroke-width': '1.9',
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round'
        }),
        h('path', {
          d: 'M17 9h-6.5A4.5 4.5 0 0 0 6 13.5V15',
          stroke: 'currentColor',
          'stroke-width': '1.9',
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round'
        })
      ]
    )
  }
}

const props = defineProps<{
  sourceCode: boolean
}>()

const { t } = useI18n()
const editorStore = useEditorStore()
const { selectionMenuState, selectionFormatState } = storeToRefs(editorStore)

const isEditorCommandDisabled = computed(() => {
  return props.sourceCode ? false : selectionMenuState.value.isDisabled
})

const isSourceEditorCommand = (command: string): boolean => {
  return command.startsWith('format.') ||
    command.startsWith('paragraph.') ||
    command === 'edit.undo' ||
    command === 'edit.redo'
}

const executeCommand = (command: string): void => {
  if (props.sourceCode && isSourceEditorCommand(command)) {
    bus.emit('source-code::toolbar-command', command)
    return
  }

  switch (command) {
    case 'format.hyperlink':
      bus.emit('open-formatting-link-dialog')
      return
    case 'toolbar.export-html':
      bus.emit('showExportDialog', 'styledHtml')
      return
    case 'toolbar.export-pdf':
      bus.emit('showExportDialog', 'pdf')
      return
  }

  bus.emit('cmd::execute', command)
}

const headingOptions = computed<ToolbarMenuOption[]>(() => [
  { command: 'paragraph.heading-1', label: t('menu.format.heading1') },
  { command: 'paragraph.heading-2', label: t('menu.format.heading2') },
  { command: 'paragraph.heading-3', label: t('menu.format.heading3') },
  { command: 'paragraph.heading-4', label: t('menu.format.heading4') },
  { command: 'paragraph.heading-5', label: t('menu.format.heading5') },
  { command: 'paragraph.heading-6', label: t('menu.format.heading6') }
])

const listOptions = computed<ToolbarMenuOption[]>(() => [
  { command: 'paragraph.bullet-list', label: t('menu.format.unorderedList') },
  { command: 'paragraph.order-list', label: t('menu.format.orderedList') },
  { command: 'paragraph.task-list', label: t('menu.format.taskList') }
])

const exportOptions = computed<ToolbarMenuOption[]>(() => [
  { command: 'toolbar.export-html', label: t('menu.file.exportHtml') },
  { command: 'toolbar.export-pdf', label: t('menu.file.exportPdf') }
])

const closeToolbarMenu = (event: Event): void => {
  const menu = (event.currentTarget as HTMLElement | null)?.closest('details')
  if (menu) {
    menu.removeAttribute('open')
  }
}

const closeMenuOnFocusOut = (event: FocusEvent): void => {
  const menu = event.currentTarget as HTMLDetailsElement
  const nextTarget = event.relatedTarget as Node | null
  if (nextTarget && menu.contains(nextTarget)) return
  menu.removeAttribute('open')
}

const executeMenuCommand = (command: string, event: Event): void => {
  executeCommand(command)
  closeToolbarMenu(event)
}

const hasSelectionFormat = (type: string): boolean => {
  return !!selectionFormatState.value[type]
}

const hasAffiliation = (type: string): boolean => {
  return !!selectionMenuState.value.affiliation[type]
}

const isCodeBlockActive = (): boolean => {
  return (
    hasAffiliation('pre') ||
    hasAffiliation('code') ||
    hasAffiliation('multiplemath') ||
    hasAffiliation('frontmatter') ||
    hasAffiliation('html')
  )
}

const createEditorItem = (item: ToolbarItem, active = false): ToolbarItem => {
  return {
    ...item,
    active: props.sourceCode ? false : active,
    disabled: isEditorCommandDisabled.value
  }
}

const groups = computed<ToolbarGroup[]>(() => [
  {
    id: 'inline',
    items: [
      createEditorItem(
        {
          command: 'format.strong',
          label: 'B',
          title: t('menu.format.bold'),
          labelClass: 'strong',
          compact: true
        },
        hasSelectionFormat('strong')
      ),
      createEditorItem(
        {
          command: 'format.emphasis',
          label: 'I',
          title: t('menu.format.italic'),
          labelClass: 'emphasis',
          compact: true
        },
        hasSelectionFormat('em')
      ),
      createEditorItem(
        {
          command: 'format.strike',
          label: 'S',
          title: t('menu.format.strikethrough'),
          labelClass: 'strike',
          compact: true
        },
        hasSelectionFormat('del')
      ),
      createEditorItem(
        {
          command: 'format.inline-code',
          label: '</>',
          title: t('menu.format.code'),
          labelClass: 'code'
        },
        hasSelectionFormat('inline_code')
      )
    ]
  },
  {
    id: 'blocks',
    items: [
      createEditorItem(
        {
          command: 'paragraph.quote-block',
          label: '>',
          title: t('menu.format.quote'),
          compact: true
        },
        hasAffiliation('blockquote')
      ),
      createEditorItem(
        {
          command: 'paragraph.code-fence',
          label: '{}',
          title: t('menu.format.codeBlock'),
          labelClass: 'code'
        },
        isCodeBlockActive()
      )
    ]
  },
  {
    id: 'insert',
    items: [
      createEditorItem(
        {
          command: 'format.hyperlink',
          label: '',
          title: t('menu.format.link'),
          icon: Link
        },
        hasSelectionFormat('link')
      ),
      createEditorItem(
        {
          command: 'format.image',
          label: '',
          title: t('menu.format.image'),
          icon: Picture
        },
        hasSelectionFormat('image')
      ),
      createEditorItem(
        {
          command: 'paragraph.table',
          label: '',
          title: t('menu.format.table'),
          icon: Grid
        },
        selectionMenuState.value.isTable
      ),
      createEditorItem(
        {
          command: 'paragraph.front-matter',
          label: '',
          title: t('menu.paragraph.frontMatter'),
          icon: PriceTag
        },
        hasAffiliation('frontmatter')
      )
    ]
  },
  {
    id: 'history',
    items: [
      createEditorItem({
        command: 'edit.undo',
        label: '',
        title: t('menu.edit.undo'),
        icon: UndoIcon
      }),
      createEditorItem({
        command: 'edit.redo',
        label: '',
        title: t('menu.edit.redo'),
        icon: RedoIcon
      })
    ]
  }
])

const groupsBeforeLists = computed<ToolbarGroup[]>(() => {
  return groups.value.filter((group) => group.id === 'inline' || group.id === 'blocks')
})

const groupsAfterLists = computed<ToolbarGroup[]>(() => {
  return groups.value.filter((group) => group.id === 'insert' || group.id === 'history')
})
</script>

<style scoped>
.formatting-toolbar {
  min-height: 34px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 18px;
  overflow: visible;
  background: color-mix(in srgb, var(--editorBgColor) 92%, var(--floatBgColor));
  border-top: 1px solid var(--editorColor04);
  border-bottom: 1px solid var(--editorColor10);
  color: var(--editorColor);
}

.toolbar-group {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  flex: 0 0 auto;
}

.toolbar-group:not(:last-child)::after {
  content: '';
  width: 1px;
  height: 14px;
  margin-left: 4px;
  background: var(--editorColor10);
}

.toolbar-button {
  height: 26px;
  min-width: 30px;
  padding: 0 8px;
  border: 1px solid transparent;
  border-radius: 5px;
  background: transparent;
  color: var(--editorColor60);
  font: inherit;
  font-size: 12px;
  line-height: 24px;
  cursor: pointer;
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.toolbar-button.compact {
  min-width: 30px;
  padding: 0 6px;
}

.toolbar-button.icon-only {
  width: 28px;
  min-width: 28px;
  padding: 0;
}

.toolbar-button:hover,
.toolbar-button:focus-visible {
  color: var(--editorColor);
  background: var(--editorColor04);
  border-color: var(--editorColor10);
}

.toolbar-button:focus-visible {
  outline: 1px solid var(--themeColor);
  outline-offset: 1px;
}

.toolbar-button.active {
  color: var(--themeColor);
  background: var(--themeColor10);
  border-color: var(--themeColor30);
}

.toolbar-button:disabled {
  cursor: default;
  opacity: 0.42;
}

.toolbar-button:disabled:hover {
  color: var(--editorColor60);
  background: transparent;
  border-color: transparent;
}

.toolbar-menu {
  position: relative;
  display: inline-flex;
  height: 26px;
  color: var(--editorColor60);
}

.toolbar-menu.menu-title {
  width: 54px;
}

.toolbar-menu.menu-list {
  width: 62px;
}

.toolbar-menu.menu-export {
  width: 44px;
}

.toolbar-menu-trigger {
  width: 100%;
  height: 26px;
  padding: 0 20px 0 8px;
  border: 1px solid var(--editorColor10);
  border-radius: 5px;
  background: transparent;
  color: var(--editorColor60);
  font: inherit;
  font-size: 12px;
  line-height: 24px;
  cursor: pointer;
  list-style: none;
  user-select: none;
  display: inline-flex;
  align-items: center;
}

.toolbar-menu-trigger::-webkit-details-marker {
  display: none;
}

.toolbar-menu-trigger::after {
  content: 'v';
  position: absolute;
  right: 7px;
  top: 0;
  height: 26px;
  line-height: 26px;
  font-size: 10px;
  color: var(--editorColor50);
  pointer-events: none;
}

.toolbar-menu-trigger:hover,
.toolbar-menu-trigger:focus-visible,
.toolbar-menu[open] > .toolbar-menu-trigger {
  color: var(--editorColor);
  background: var(--editorColor04);
  border-color: var(--editorColor10);
}

.toolbar-menu-trigger:focus-visible {
  outline: 1px solid var(--themeColor);
  outline-offset: 1px;
}

.toolbar-menu-panel {
  position: absolute;
  z-index: 50;
  top: calc(100% + 4px);
  left: 0;
  min-width: 180px;
  max-width: 240px;
  padding: 4px;
  border: 1px solid var(--editorColor10);
  border-radius: 5px;
  background: var(--floatBgColor);
  box-shadow: 0 8px 18px rgb(0 0 0 / 18%);
}

.toolbar-menu-panel.align-right {
  left: auto;
  right: 0;
}

.toolbar-menu-item {
  width: 100%;
  min-height: 26px;
  padding: 0 8px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--editorColor);
  font: inherit;
  font-size: 12px;
  line-height: 24px;
  text-align: left;
  cursor: pointer;
  white-space: nowrap;
}

.toolbar-menu-item:hover,
.toolbar-menu-item:focus-visible {
  background: var(--editorColor04);
  outline: none;
}

.toolbar-menu-item:disabled {
  cursor: default;
  opacity: 0.42;
}

.toolbar-label.strong {
  font-weight: 700;
}

.toolbar-label.emphasis {
  font-style: italic;
}

.toolbar-label.strike {
  text-decoration: line-through;
}

.toolbar-label.code {
  font-family: monospace;
}

.toolbar-icon {
  width: 14px;
  height: 14px;
  flex: 0 0 14px;
}
</style>
