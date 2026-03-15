<template>
  <div class="wysiwyg-toolbar" v-if="fullWysiwyg && !sourceCode">
    <div class="toolbar-group">
      <button
        class="toolbar-btn"
        :class="{ active: isFormatActive('strong') }"
        title="Bold (Cmd+B)"
        @click="applyFormat('strong')"
      >
        <strong>B</strong>
      </button>
      <button
        class="toolbar-btn"
        :class="{ active: isFormatActive('em') }"
        title="Italic (Cmd+I)"
        @click="applyFormat('em')"
      >
        <em>I</em>
      </button>
      <button
        class="toolbar-btn"
        :class="{ active: isFormatActive('u') }"
        title="Underline (Cmd+U)"
        @click="applyFormat('u')"
      >
        <u>U</u>
      </button>
      <button
        class="toolbar-btn"
        :class="{ active: isFormatActive('del') }"
        title="Strikethrough (Cmd+D)"
        @click="applyFormat('del')"
      >
        <del>S</del>
      </button>
      <button
        class="toolbar-btn"
        :class="{ active: isFormatActive('mark') }"
        title="Highlight (Shift+Cmd+H)"
        @click="applyFormat('mark')"
      >
        <span class="highlight-icon">H</span>
      </button>
      <button
        class="toolbar-btn"
        :class="{ active: isFormatActive('inline_code') }"
        title="Inline Code (Cmd+`)"
        @click="applyFormat('inline_code')"
      >
        <code>&lt;/&gt;</code>
      </button>
    </div>
    <div class="toolbar-separator"></div>
    <div class="toolbar-group">
      <select
        class="toolbar-select"
        :value="currentBlockType"
        @change="applyParagraph($event.target.value)"
      >
        <option value="paragraph">Paragraph</option>
        <option value="heading 1">Heading 1</option>
        <option value="heading 2">Heading 2</option>
        <option value="heading 3">Heading 3</option>
        <option value="heading 4">Heading 4</option>
        <option value="heading 5">Heading 5</option>
        <option value="heading 6">Heading 6</option>
      </select>
    </div>
    <div class="toolbar-separator"></div>
    <div class="toolbar-group">
      <button
        class="toolbar-btn"
        title="Bullet List"
        @click="applyParagraph('ul-bullet')"
      >&#8226;</button>
      <button
        class="toolbar-btn"
        title="Numbered List"
        @click="applyParagraph('ol-order')"
      >1.</button>
      <button
        class="toolbar-btn"
        title="Task List"
        @click="applyParagraph('ul-task')"
      >&#9745;</button>
      <button
        class="toolbar-btn"
        title="Block Quote"
        @click="applyParagraph('blockquote')"
      >&#8220;</button>
    </div>
    <div class="toolbar-separator"></div>
    <div class="toolbar-group">
      <button
        class="toolbar-btn"
        title="Insert Link (Cmd+L)"
        @click="applyFormat('link')"
      >&#128279;</button>
      <button
        class="toolbar-btn"
        title="Insert Image (Shift+Cmd+I)"
        @click="applyFormat('image')"
      >&#128247;</button>
      <button
        class="toolbar-btn"
        title="Insert Table"
        @click="insertTable"
      >&#9638;</button>
      <button
        class="toolbar-btn"
        title="Code Block"
        @click="applyParagraph('pre')"
      >{ }</button>
      <button
        class="toolbar-btn"
        title="Horizontal Rule"
        @click="applyParagraph('hr')"
      >&mdash;</button>
    </div>
    <div class="toolbar-separator"></div>
    <div class="toolbar-group">
      <button
        class="toolbar-btn"
        title="Clear Formatting (Shift+Cmd+R)"
        @click="applyFormat('clear')"
      >&#10006;</button>
    </div>
  </div>
</template>

<script>
import { mapState } from 'vuex'
import bus from '@/bus'

export default {
  data () {
    return {
      activeFormats: [],
      currentBlockType: 'paragraph'
    }
  },

  computed: {
    ...mapState({
      fullWysiwyg: state => state.preferences.fullWysiwyg,
      sourceCode: state => state.preferences.sourceCode
    })
  },

  created () {
    bus.$on('selectionFormats', this.handleSelectionFormats)
  },

  beforeDestroy () {
    bus.$off('selectionFormats', this.handleSelectionFormats)
  },

  methods: {
    isFormatActive (type) {
      return this.activeFormats.some(f => f.type === type || (f.type === 'html_tag' && f.tag === type))
    },

    handleSelectionFormats (formats) {
      if (formats && formats.formats) {
        this.activeFormats = formats.formats
      }
      if (formats && formats.block) {
        const { type } = formats.block
        if (/^h(\d)$/.test(type)) {
          this.currentBlockType = `heading ${type.charAt(1)}`
        } else {
          this.currentBlockType = 'paragraph'
        }
      }
    },

    applyFormat (type) {
      bus.$emit('format', type)
    },

    applyParagraph (type) {
      bus.$emit('paragraph', type)
    },

    insertTable () {
      bus.$emit('insert-table')
    }
  }
}
</script>

<style scoped>
  .wysiwyg-toolbar {
    display: flex;
    align-items: center;
    padding: 4px 12px;
    border-bottom: 1px solid var(--floatBorderColor, #e5e5e5);
    background: var(--editorBgColor, #fff);
    flex-shrink: 0;
    gap: 2px;
    user-select: none;
    -webkit-app-region: no-drag;
    overflow-x: auto;
  }

  .toolbar-group {
    display: flex;
    align-items: center;
    gap: 1px;
  }

  .toolbar-separator {
    width: 1px;
    height: 20px;
    background: var(--floatBorderColor, #ddd);
    margin: 0 6px;
    flex-shrink: 0;
  }

  .toolbar-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--editorColor, #333);
    font-size: 13px;
    cursor: pointer;
    padding: 0;
    transition: background 0.15s;
  }

  .toolbar-btn:hover {
    background: var(--sideBarItemHoverBgColor, rgba(0,0,0,0.06));
  }

  .toolbar-btn.active {
    background: var(--themeColor, #409eff);
    color: #fff;
  }

  .toolbar-btn code {
    font-size: 11px;
    font-family: monospace;
    background: none;
    padding: 0;
  }

  .toolbar-select {
    height: 28px;
    border: 1px solid var(--floatBorderColor, #ddd);
    border-radius: 4px;
    background: transparent;
    color: var(--editorColor, #333);
    font-size: 12px;
    padding: 0 4px;
    cursor: pointer;
    outline: none;
  }

  .toolbar-select:focus {
    border-color: var(--themeColor, #409eff);
  }

  .highlight-icon {
    background: #fef3a7;
    padding: 0 3px;
    border-radius: 2px;
    color: #333;
  }
</style>
