<template>
  <div
    class="side-bar-toc"
    :class="[{ 'side-bar-toc-overflow': !wordWrapInToc, 'side-bar-toc-wordwrap': wordWrapInToc }]"
  >
    <el-tree
      v-if="keyedToc.length"
      ref="tocTreeRef"
      :data="keyedToc"
      node-key="key"
      :default-expanded-keys="expandedKeys"
      highlight-current
      :props="defaultProps"
      :expand-on-click-node="false"
      :indent="10"
      :icon="ArrowRight"
      @node-click="handleClick"
      @node-expand="onExpand"
      @node-collapse="onCollapse"
    >
      <!-- Element Plus escapes `data.label`, so showing the heading HTML needs a
           scoped slot; re-add the label wrapper the default renderer would have
           made so the outline CSS keeps applying. -->
      <template #default="{ data }">
        <!-- eslint-disable vue/no-v-html -- sanitized by labelHtmlOf -->
        <span
          class="el-tree-node__label"
          :data-toc-key="data.key"
          :title="plainLabel(data)"
          v-html="labelHtmlOf(data)"
        />
        <!-- eslint-enable vue/no-v-html -->
      </template>
    </el-tree>
    <p
      v-else
      class="outline-empty"
    >
      {{ t('sideBar.toc.empty') }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useEditorStore } from '@/store/editor'
import { usePreferencesStore } from '@/store/preferences'
import { deriveKeyedToc, type KeyedTocNode } from '@/util/tocKeys'
import { sanitize, TOC_DOMPURIFY_CONFIG } from '@/util/dompurify'
import bus from '../../bus'
import { storeToRefs } from 'pinia'
import { ArrowRight } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'
import type { TreeInstance } from 'element-plus'

const { t } = useI18n()
const props = defineProps<{ visible?: boolean }>()

const editorStore = useEditorStore()
const preferencesStore = usePreferencesStore()

const tocTreeRef = ref<TreeInstance | null>(null)
// Heading updates during a TOC jump describe the animation's intermediate
// sections; they must not move the outline the user is browsing.
let preserveOutlinePosition = false
const resumeFollowingDocument = (event: Event): void => {
  if (event.target instanceof Element && event.target.closest('.document-body')) {
    preserveOutlinePosition = false
  }
}
const navigationEvents = ['wheel', 'pointerdown', 'keydown'] as const
onMounted(() => {
  for (const event of navigationEvents) {
    document.addEventListener(event, resumeFollowingDocument, { capture: true, passive: true })
  }
})
onBeforeUnmount(() => {
  for (const event of navigationEvents) {
    document.removeEventListener(event, resumeFollowingDocument, true)
  }
})

const defaultProps = {
  children: 'children',
  label: 'label'
}

interface TocNodeData {
  label?: unknown
  labelHtml?: unknown
}

const plainLabel = (data: TocNodeData): string =>
  typeof data.label === 'string' ? data.label : ''

const escapeHtml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const labelHtmlOf = (data: TocNodeData): string => {
  const html = typeof data.labelHtml === 'string' ? data.labelHtml : ''
  return html ? sanitize(html, TOC_DOMPURIFY_CONFIG) : escapeHtml(plainLabel(data))
}

const { toc } = storeToRefs(editorStore)
const { wordWrapInToc } = storeToRefs(preferencesStore)

// Stable per-node key so el-tree preserves the user's expand/collapse state
// across content edits (#3028) and tab switches (#3791). See deriveKeyedToc.
const keyedToc = computed<KeyedTocNode[]>(() => deriveKeyedToc(toc.value))

// Track which headings the user collapsed, by stable key (#3028). Headings are
// expanded by default; a collapse is remembered here.
const collapsedKeys = ref<Set<string>>(new Set())
const collapsedByFile = new Map<string, Set<string>>()
watch(() => editorStore.currentFile?.id, (id, previousId) => {
  preserveOutlinePosition = false
  if (previousId) collapsedByFile.set(previousId, collapsedKeys.value)
  collapsedKeys.value = id ? collapsedByFile.get(id) ?? new Set() : new Set()
})

const onCollapse = (data: { key?: string }): void => {
  if (data.key) collapsedKeys.value = new Set(collapsedKeys.value).add(data.key)
}

const onExpand = (data: { key?: string }): void => {
  if (!data.key) return
  const next = new Set(collapsedKeys.value)
  next.delete(data.key)
  collapsedKeys.value = next
}

// Exclude collapsed nodes and their descendants so tree rebuilds preserve collapse state.
const expandedKeys = computed<string[]>(() => {
  const keys: string[] = []
  const walk = (nodes: KeyedTocNode[], hiddenByAncestor: boolean): void => {
    for (const node of nodes) {
      const collapsed = hiddenByAncestor || collapsedKeys.value.has(node.key)
      if (!collapsed) keys.push(node.key)
      walk(node.children, collapsed)
    }
  }
  walk(keyedToc.value, false)
  return keys
})

// The store names the caret's heading by engine slug; el-tree keys its nodes by
// githubSlug. Both sit on the same node, so one resolves to the other.
const activeNodeKey = computed<string>(() => {
  const slug = editorStore.activeHeadingSlug
  if (typeof slug !== 'string') return ''
  const findKey = (nodes: KeyedTocNode[]): string => {
    for (const node of nodes) {
      if (node.slug === slug) return node.key
      const found = findKey(node.children)
      if (found) return found
    }
    return ''
  }
  return findKey(keyedToc.value)
})

// The current-node-key prop also expands ancestors, so synchronize only through
// the setter to preserve user-collapsed sections during heading changes.
const revealActiveHeading = async(): Promise<void> => {
  await nextTick()
  const tree = tocTreeRef.value
  tree?.setCurrentKey(activeNodeKey.value || undefined, false)
  if (!tree || props.visible === false) return
  const treeElement = tree.$el as HTMLElement
  let node = activeNodeKey.value ? tree.getNode(activeNodeKey.value) : null
  for (let ancestor = node?.parent; ancestor?.level; ancestor = ancestor.parent) {
    if (!ancestor.expanded) node = ancestor
  }
  if (!node) return
  tree.setCurrentKey(node.key, false)
  if (preserveOutlinePosition) return
  const label = Array.from(treeElement.querySelectorAll<HTMLElement>('[data-toc-key]'))
    .find(element => element.dataset.tocKey === node.key)
  if (!label) return
  const bounds = label.getBoundingClientRect()
  const viewport = treeElement.getBoundingClientRect()
  if (bounds.top < viewport.top) treeElement.scrollTop += bounds.top - viewport.top - 8
  else if (bounds.bottom > viewport.bottom) treeElement.scrollTop += bounds.bottom - viewport.bottom + 8
}
watch([activeNodeKey, () => props.visible, keyedToc, expandedKeys], revealActiveHeading, { flush: 'post' })

const handleClick = (data: { slug?: unknown }): void => {
  // Skip headings without usable slugs; the editor resolves scroll targets by slug.
  if (typeof data.slug !== 'string' || data.slug.length === 0) return
  preserveOutlinePosition = true
  bus.emit('scroll-to-header', data.slug)
}
</script>

<style>
.side-bar-toc {
  height: 100%;
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.outline-empty {
  padding: 0 12px;
  color: var(--sideBarColor);
  opacity: 0.65;
}

.side-bar-toc .el-tree-node {
  margin-top: 8px;
}

.side-bar-toc .el-tree {
  background: transparent;
  color: var(--sideBarColor);
  flex: 1;
  min-height: 0;
  scrollbar-width: none;
}

.side-bar-toc .el-tree::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
}

/* The scoped slot replaced Element Plus's `<el-text truncated>` label, so its
   truncation is re-declared here. `color: inherit` overrides the gray that
   `el-text` imposed, which beat the themed color from `.el-tree` (#5094). */
.side-bar-toc .el-tree-node__label {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  color: inherit;
  align-self: center;
  overflow-wrap: break-word;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.side-bar-toc .el-tree-node__expand-icon {
  color: var(--sideBarIconColor);
}

.side-bar-toc .el-tree-node:focus > .el-tree-node__content {
  background-color: var(--sideBarItemHoverBgColor);
}

.side-bar-toc .el-tree-node__content:hover {
  background: var(--sideBarItemHoverBgColor);
}

/* Element Plus paints `.is-current` from a selector carrying
   `.el-tree--highlight-current`, so overriding it needs that class too. */
.side-bar-toc .el-tree--highlight-current .el-tree-node.is-current > .el-tree-node__content {
  background-color: var(--sideBarItemHoverBgColor);
  color: var(--themeColor);
}

.side-bar-toc > li {
  font-size: 14px;
  margin-bottom: 15px;
  cursor: pointer;
}
.side-bar-toc-overflow .el-tree {
  overflow: auto;
}
.side-bar-toc-wordwrap .el-tree {
  overflow-x: hidden;
  overflow-y: auto;
}

.side-bar-toc-wordwrap .el-tree-node__content {
  white-space: normal;
  height: auto;
  min-height: 26px;
}

.side-bar-toc-wordwrap .el-tree-node__content .el-tree-node__label {
  white-space: normal;
  text-overflow: clip;
  overflow: visible;
}

.side-bar-toc .el-tree-node__label strong {
  font-weight: 700;
}

.side-bar-toc .el-tree-node__label em {
  font-style: italic;
}

.side-bar-toc .el-tree-node__label del {
  opacity: 0.65;
  text-decoration: line-through;
}

.side-bar-toc .el-tree-node__label mark {
  padding: 0 2px;
  color: inherit;
  background: var(--highlightColor);
  border-radius: 2px;
}

.side-bar-toc .el-tree-node__label code {
  padding: 0 3px;
  font-family: 'DejaVu Sans Mono', 'Source Code Pro', 'Droid Sans Mono', Consolas, monospace;
  font-size: 0.9em;
  color: var(--codeBlockColor);
  background: var(--codeBgColor);
  border-radius: 3px;
}

.side-bar-toc .el-tree-node__label sup,
.side-bar-toc .el-tree-node__label sub {
  /* Keeps a raised superscript from growing the row. */
  line-height: 0;
}
</style>
