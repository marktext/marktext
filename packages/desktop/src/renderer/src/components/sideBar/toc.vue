<template>
  <div
    class="side-bar-toc"
    :class="[{ 'side-bar-toc-overflow': !wordWrapInToc, 'side-bar-toc-wordwrap': wordWrapInToc }]"
  >
    <div class="toc-header">
      <span class="title">{{ t('sideBar.toc.title') }}</span>
      <span v-if="keyedToc.length" class="toc-toolbar">
        <button
          type="button"
          class="toc-toolbar-btn"
          title="Expand all"
          aria-label="Expand all"
          @click="handleExpandAll"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M1 3.5L4 7l3-3.5H1zm0 9L4 16l3-3.5H1zm7-8h7V3H8v1.5zm0 5h7V8H8v1.5zm0 5h7V13H8v1.5z" />
          </svg>
        </button>
        <button
          type="button"
          class="toc-toolbar-btn"
          title="Collapse all"
          aria-label="Collapse all"
          @click="handleCollapseAll"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M1 7l3-3.5L7 7H1zm0 5l3-3.5L7 12H1zm7-7.5h7V3H8v1.5zm0 5h7V8H8v1.5zm0 5h7V13H8v1.5z" />
          </svg>
        </button>
      </span>
    </div>
    <el-tree
      v-if="keyedToc.length"
      ref="tocTreeRef"
      :data="keyedToc"
      node-key="key"
      :default-expanded-keys="expandedKeys"
      :current-node-key="activeNodeKey"
      highlight-current
      :props="defaultProps"
      :expand-on-click-node="false"
      :indent="10"
      :icon="ArrowRight"
      @node-click="handleClick"
      @node-expand="onExpand"
      @node-collapse="onCollapse"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue'
import { useEditorStore } from '@/store/editor'
import { usePreferencesStore } from '@/store/preferences'
import { deriveKeyedToc, type KeyedTocNode } from '@/util/tocKeys'
import bus from '../../bus'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { ArrowRight } from '@element-plus/icons-vue'
import type { TreeInstance } from 'element-plus'

const { t } = useI18n()

const editorStore = useEditorStore()
const preferencesStore = usePreferencesStore()

const tocTreeRef = ref<TreeInstance | null>(null)

const defaultProps = {
  children: 'children',
  label: 'label'
}

const { toc } = storeToRefs(editorStore)
const { wordWrapInToc } = storeToRefs(preferencesStore)

// Stable per-node key so el-tree preserves the user's expand/collapse state
// across content edits (#3028) and tab switches (#3791). See deriveKeyedToc.
const keyedToc = computed<KeyedTocNode[]>(() => deriveKeyedToc(toc.value))

// Track which headings the user collapsed, by stable key (#3028). Headings are
// expanded by default; a collapse is remembered here.
const collapsedKeys = ref<Set<string>>(new Set())

const onCollapse = (data: { key?: string }): void => {
  if (data.key) collapsedKeys.value = new Set(collapsedKeys.value).add(data.key)
}

const onExpand = (data: { key?: string }): void => {
  if (!data.key) return
  const next = new Set(collapsedKeys.value)
  next.delete(data.key)
  collapsedKeys.value = next
}

// The set el-tree should have expanded: every node that is neither collapsed
// nor inside a collapsed ancestor. On each content edit el-tree rebuilds and
// re-applies these keys, so binding the *correct* set makes it paint the right
// state directly — instead of expanding everything and then collapsing, which
// flickered.
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

// Map the store's activeHeadingSlug (an engine-internal slug like "mu-42") to
// the el-tree node-key (a content-derived githubSlug like "my-heading"). The
// slug lives on the flat TOC item; the key lives on the keyed tree node at the
// same position.
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

// el-tree's `current-node-key` prop only sets the initial value; subsequent
// changes require the imperative `setCurrentKey` call.
watch(activeNodeKey, (key) => {
  tocTreeRef.value?.setCurrentKey(key || undefined)
})

// --- Expand / Collapse ---
// Collect all keys in a subtree (the node itself + all descendants).
const collectKeys = (nodes: KeyedTocNode[]): string[] => {
  const keys: string[] = []
  const walk = (list: KeyedTocNode[]): void => {
    for (const node of list) {
      keys.push(node.key)
      walk(node.children)
    }
  }
  walk(nodes)
  return keys
}

// Find the active node's subtree. Returns the node that matches the current
// activeNodeKey, or null if there's no active heading (= operate on root).
const findActiveSubtree = (): KeyedTocNode | null => {
  const key = activeNodeKey.value
  if (!key) return null
  const find = (nodes: KeyedTocNode[]): KeyedTocNode | null => {
    for (const node of nodes) {
      if (node.key === key) return node
      const found = find(node.children)
      if (found) return found
    }
    return null
  }
  return find(keyedToc.value)
}

// Synchronise el-tree's internal Node objects with our collapsedKeys state.
// Called after any programmatic change to collapsedKeys so the visual tree
// matches immediately, without waiting for a data-driven re-render (which
// el-tree does not reliably honour for default-expanded-keys after mount).
const syncTreeNodes = (): void => {
  const tree = tocTreeRef.value
  if (!tree) return
  const allKeys = collectKeys(keyedToc.value)
  for (const key of allKeys) {
    const node = tree.getNode(key)
    if (!node) continue
    const shouldBeCollapsed = collapsedKeys.value.has(key)
    if (shouldBeCollapsed && node.expanded) {
      node.collapse()
    } else if (!shouldBeCollapsed && !node.expanded) {
      node.expand()
    }
  }
}

// Expand: if cursor is inside a heading, expand that node + its children;
// otherwise expand everything.
const handleExpandAll = (): void => {
  const activeNode = findActiveSubtree()
  const target = activeNode ? [activeNode] : keyedToc.value
  const keysToExpand = collectKeys(target)
  const next = new Set(collapsedKeys.value)
  for (const key of keysToExpand) {
    next.delete(key)
  }
  collapsedKeys.value = next
  nextTick(syncTreeNodes)
}

// Collapse: if cursor is inside a heading, collapse that node + its children;
// otherwise collapse everything.
const handleCollapseAll = (): void => {
  const activeNode = findActiveSubtree()
  const target = activeNode ? [activeNode] : keyedToc.value
  const keysToCollapse = collectKeys(target)
  const next = new Set(collapsedKeys.value)
  for (const key of keysToCollapse) {
    next.add(key)
  }
  collapsedKeys.value = next
  nextTick(syncTreeNodes)
}

const handleClick = (data: { slug?: unknown }): void => {
  // editor.vue resolves slugs by document order — bail out if the node has no
  // slug to avoid emitting invalid payloads.
  if (typeof data.slug !== 'string' || data.slug.length === 0) return
  bus.emit('scroll-to-header', data.slug)
}
</script>

<style>
.side-bar-toc {
  height: calc(100% - 35px);
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.side-bar-toc .toc-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 37px 0 10px 0;
  padding-left: 25px;
  padding-right: 12px;
  flex-shrink: 0;
}

.side-bar-toc .toc-header .title {
  color: var(--sideBarTitleColor);
  font-weight: 600;
  font-size: 16px;
}

.side-bar-toc .toc-toolbar {
  display: flex;
  gap: 4px;
}

.side-bar-toc .toc-toolbar-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 3px;
  background: transparent;
  color: var(--sideBarColor);
  cursor: pointer;
  opacity: 0.6;
  transition: opacity 0.15s, background-color 0.15s;
}

.side-bar-toc .toc-toolbar-btn:hover {
  opacity: 1;
  background-color: var(--sideBarItemHoverBgColor);
}

.side-bar-toc .el-tree {
  background: transparent;
  color: var(--sideBarColor);
  --el-tree-text-color: var(--sideBarColor);
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

.side-bar-toc .el-tree-node {
  margin-top: 8px;
}

.side-bar-toc .el-tree-node:focus > .el-tree-node__content {
  background-color: var(--sideBarItemHoverBgColor);
}

.side-bar-toc .el-tree-node__content:hover {
  background: var(--sideBarItemHoverBgColor);
}

/* Active heading highlight — requires `.el-tree--highlight-current` in the
   selector to win specificity over Element Plus's built-in transparent rule. */
.side-bar-toc .el-tree--highlight-current .el-tree-node.is-current > .el-tree-node__content {
  background-color: var(--sideBarItemHoverBgColor);
  color: var(--themeColor);
}

.side-bar-toc > li {
  font-size: 14px;
  margin-bottom: 15px;
  cursor: pointer;
}

/* Overflow variants: control the tree's horizontal overflow behavior. */
.side-bar-toc-overflow .el-tree {
  overflow-x: auto;
}
.side-bar-toc-wordwrap .el-tree {
  overflow-x: hidden;
}

.side-bar-toc-wordwrap .el-tree-node__content {
  white-space: normal;
  height: auto;
  min-height: 26px;
}
</style>
