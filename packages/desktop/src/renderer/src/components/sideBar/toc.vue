<template>
  <div
    class="side-bar-toc"
    :class="[{ 'side-bar-toc-overflow': !wordWrapInToc, 'side-bar-toc-wordwrap': wordWrapInToc }]"
  >
    <div class="title">
      {{ t('sideBar.toc.title') }}
    </div>
    <el-tree
      v-if="keyedToc.length"
      :data="keyedToc"
      node-key="key"
      :default-expanded-keys="expandedKeys"
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
import { computed, ref } from 'vue'
import { useEditorStore } from '@/store/editor'
import { usePreferencesStore } from '@/store/preferences'
import bus from '../../bus'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { ArrowRight } from '@element-plus/icons-vue'

const { t } = useI18n()

const editorStore = useEditorStore()
const preferencesStore = usePreferencesStore()

const defaultProps = {
  children: 'children',
  label: 'label'
}

const { toc } = storeToRefs(editorStore)
const { wordWrapInToc } = storeToRefs(preferencesStore)

interface KeyedTocNode {
  key: string
  label: unknown
  slug: unknown
  children: KeyedTocNode[]
}

// The TOC nodes carry no stable id, so el-tree (without a node-key) discarded
// the user's expand/collapse state on every content edit (#3028). Derive a
// stable key per node — its slug, deduplicated in document order so duplicate
// headings stay unique — and let el-tree preserve state by that key.
const keyedToc = computed<KeyedTocNode[]>(() => {
  const seen = new Map<string, number>()
  const assign = (nodes: Array<Record<string, unknown>>): KeyedTocNode[] =>
    nodes.map((node) => {
      const base = typeof node.slug === 'string' && node.slug ? node.slug : 'heading'
      const count = seen.get(base) ?? 0
      seen.set(base, count + 1)
      return {
        key: count === 0 ? base : `${base}-${count}`,
        label: node.label,
        slug: node.slug,
        children: assign((node.children as Array<Record<string, unknown>>) ?? [])
      }
    })
  return assign(toc.value as unknown as Array<Record<string, unknown>>)
})

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

const handleClick = (data: { slug?: unknown }): void => {
  // editor.vue builds a CSS selector with `#${slug}` — bail out if the
  // node has no slug (e.g. unsluggable headings) to avoid emitting
  // `undefined` / non-string payloads and producing `#undefined` selectors.
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
}

.side-bar-toc .title {
  color: var(--sideBarTitleColor);
  font-weight: 600;
  font-size: 16px;
  margin: 37px 0 10px 0;
  padding-left: 25px;
}

.side-bar-toc .el-tree-node {
  margin-top: 8px;
}

.side-bar-toc .el-tree {
  background: transparent;
  color: var(--sideBarColor);
}

.side-bar-toc .el-tree-node:focus > .el-tree-node__content {
  background-color: var(--sideBarItemHoverBgColor);
}

.side-bar-toc .el-tree-node__content:hover {
  background: var(--sideBarItemHoverBgColor);
}

.side-bar-toc > li {
  font-size: 14px;
  margin-bottom: 15px;
  cursor: pointer;
}
.side-bar-toc-overflow {
  overflow: auto;
}
.side-bar-toc-wordwrap {
  overflow-x: hidden;
  overflow-y: auto;
}

.side-bar-toc-wordwrap .el-tree-node__content {
  white-space: normal;
  height: auto;
  min-height: 26px;
}
</style>
