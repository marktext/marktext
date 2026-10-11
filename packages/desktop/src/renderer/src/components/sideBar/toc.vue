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
    >
      <!-- Element Plus escapes `data.label`, so showing the heading HTML needs a
           scoped slot; re-add the label wrapper the default renderer would have
           made so the outline CSS keeps applying. -->
      <template #default="{ data }">
        <!-- eslint-disable vue/no-v-html -- sanitized by labelHtmlOf -->
        <span
          class="el-tree-node__label"
          :title="plainLabel(data)"
          v-html="labelHtmlOf(data)"
        />
        <!-- eslint-enable vue/no-v-html -->
      </template>
    </el-tree>
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

// `current-node-key` only seeds el-tree at mount; later changes need the setter.
watch(activeNodeKey, (key) => {
  tocTreeRef.value?.setCurrentKey(key || undefined)
})

const handleClick = (data: { slug?: unknown }): void => {
  // editor.vue resolves the slug to a heading by document order — bail out if
  // the node has no slug (e.g. unsluggable headings) rather than emitting an
  // `undefined` / non-string payload it cannot match.
  if (typeof data.slug !== 'string' || data.slug.length === 0) return
  bus.emit('scroll-to-header', data.slug)
}

// A heading that overflows its line by only a sliver wraps into a second line
// holding one or two characters — an ugly runt. In that band, trim to a single
// line instead; anything needing clearly more than one line still gets two.
// CSS cannot make this call: `text-wrap: balance` / `pretty` are inert inside
// the `-webkit-box` the line clamp requires, and the clamped box hides the
// overflow, so measure the single-line width ourselves and mark the label.
//
// The cutoff is an absolute width, not a ratio: on a narrow sidebar "40% of a
// line" is still only a couple of characters, so a relative band keeps letting
// runts through. A second line must carry at least `RUNT_MIN_EM` characters
// (and at least `RUNT_MIN_RATIO` of the line) to be worth having.
const RUNT_MIN_EM = 3 // characters' worth of width, in em
const RUNT_MIN_RATIO = 0.35

const measureClampCounts = (): void => {
  const root = tocTreeRef.value?.$el as HTMLElement | undefined
  if (!root) return
  const labels = Array.from(root.querySelectorAll<HTMLElement>('.el-tree-node__label'))
  if (labels.length === 0) return

  // Single-line width, measured on an out-of-flow clone of each label.
  // `position: absolute` makes the clone shrink-to-fit, so its width *is* the
  // text width, and it stays out of the row's layout so nothing moves while we
  // read. Reading `scrollWidth` off the live label does NOT work: for text that
  // overflows its box it reports the box width, which zeroed `tail` below and
  // silently disabled the whole check.
  const available = labels.map((label) => label.clientWidth)
  const probes = labels.map((label) => {
    const probe = label.cloneNode(true) as HTMLElement
    probe.style.cssText =
      'position:absolute;left:-99999px;top:0;visibility:hidden;pointer-events:none;' +
      'display:block;white-space:nowrap;-webkit-line-clamp:none;'
    label.parentElement?.appendChild(probe)
    return probe
  })
  const singleLine = probes.map((probe) => probe.getBoundingClientRect().width)
  for (const probe of probes) probe.remove()

  // Every label shares the tree's font size; read it once.
  const labelFontSize = Number.parseFloat(getComputedStyle(labels[0]).fontSize) || 14

  labels.forEach((label, index) => {
    const line = available[index]
    if (!line) return
    // What spills past a full first line is what the second line would carry.
    const tail = singleLine[index] - line
    const runt = tail > 0 && tail < Math.max(RUNT_MIN_RATIO * line, RUNT_MIN_EM * labelFontSize)
    label.dataset.clamp = runt ? '1' : '2'
  })
}

// Measuring touches layout, so keep it off the render path.
const scheduleMeasure = (): void => {
  if (!wordWrapInToc.value) return
  void nextTick(measureClampCounts)
}

watch([keyedToc, wordWrapInToc], scheduleMeasure)

let tocResizeObserver: ResizeObserver | null = null

onMounted(() => {
  scheduleMeasure()
  const root = tocTreeRef.value?.$el as HTMLElement | undefined
  if (root && typeof ResizeObserver !== 'undefined') {
    // The sidebar is resizable, so the wrap points move without the TOC changing.
    tocResizeObserver = new ResizeObserver(scheduleMeasure)
    tocResizeObserver.observe(root)
  }
})

onBeforeUnmount(() => {
  tocResizeObserver?.disconnect()
  tocResizeObserver = null
})
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

.side-bar-toc .title {
  color: var(--sideBarTitleColor);
  font-weight: 600;
  font-size: 16px;
  margin: 37px 0 10px 0;
  padding-left: 25px;
  flex-shrink: 0;
}

.side-bar-toc .el-tree-node {
  margin-top: 8px;
}

/* The outline scrolls, the panel title does not — same split the file tree
   (`.tree-wrapper`) and the search results already use. */
.side-bar-toc .el-tree {
  background: transparent;
  color: var(--sideBarColor);
  flex: 1;
  min-height: 0;
}

/* The scoped slot replaced Element Plus's `<el-text truncated>` label, so its
   truncation is re-declared here. It is laid out as a shrinking flex child with
   `min-width: 0` instead of an inline-block capped with `max-width: 100%`: the
   tree indents children with padding, so its content box can be wider than the
   sidebar and the percentage cap resolved against that wider box — the ellipsis
   then landed past the visible edge and long headings spilled instead of
   truncating. `color: inherit` overrides the gray that `el-text` imposed, which
   beat the themed color from `.el-tree` (#5094). */
.side-bar-toc .el-tree-node__label {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  color: inherit;
  align-self: center;
  /* Long unbreakable tokens — an inline `<code>state=REFUSED</code>` in a
     heading, say — otherwise keep their full width as the flex item's
     min-content, so on a narrow sidebar they push past the row's own box and
     the tree's `overflow-x: hidden` cuts them off. */
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
  align-items: flex-start;
}

.side-bar-toc-wordwrap .el-tree-node__content > * {
  align-self: flex-start;
}

.side-bar-toc-wordwrap .el-tree-node__content .el-tree-node__label {
  white-space: normal;
  /* At most two lines, then an ellipsis — the same shape Element Plus uses for
     `.el-text.is-line-clamp`. The clamp is what needs `overflow: hidden`. */
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

/* Set by `measureClampCounts`: a heading that overflows by only a sliver would
   wrap onto a second line holding one or two characters, so it is trimmed to a
   single line instead. */
.side-bar-toc-wordwrap .el-tree-node__label[data-clamp='1'] {
  -webkit-line-clamp: 1;
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
/* Element Plus pins every row to `var(--el-tree-node-content-height)` (26px).
   Nothing in the outline is a fixed height: a wrapped entry has to grow the row
   around it. Three classes beat Element Plus's single class, so no `!important`.
   (Do NOT put the line clamp here — `display: -webkit-box` on the row replaces
   `display: flex`, stacking the caret above the text and dropping the indent.) */
.side-bar-toc .el-tree-node .el-tree-node__content {
  height: unset;
}
</style>
