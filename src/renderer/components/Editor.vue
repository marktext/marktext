<template>
  <div
    class="editor-wrapper"
    :class="[{ 'typewriter': typewriter, 'focus': focus, 'source': sourceCode }, theme]"
  >
    <div
      ref="editor"
      class="editor-component"
    ></div>
    <el-dialog 
      :visible.sync="dialogTableVisible"
      :show-close="isShowClose"
      :modal="true"
      custom-class="ag-dialog-table"
      width="450px"
      center
    >
      <div slot="title" class="dialog-title">
        <svg class="icon" aria-hidden="true">
          <use xlink:href="#icon-table-3d"></use>
        </svg>
      </div>
      <el-form :model="tableChecker" :inline="true">
        <el-form-item label="Rows">
          <el-input-number
            ref="rowInput"
            size="mini"
            v-model="tableChecker.rows"
            controls-position="right"
            :min="2"
            :max="20"
          ></el-input-number>
        </el-form-item>
        <el-form-item label="Columns">
          <el-input-number
            size="mini"
            v-model="tableChecker.columns"
            controls-position="right"
            :min="2"
            :max="20"
          ></el-input-number>
        </el-form-item>
      </el-form>
      <div slot="footer" class="dialog-footer">
        <el-button @click="dialogTableVisible = false" size="mini">
          <svg class="icon" aria-hidden="true">
            <use xlink:href="#icon-close"></use>
          </svg>
        </el-button>
        <el-button type="primary" @click="handleDialogTableConfirm" size="mini">
          <svg class="icon" aria-hidden="true">
            <use xlink:href="#icon-gou"></use>
          </svg>
        </el-button>
      </div>
    </el-dialog>
    <aidou
      @select="handleSelect"
    ></aidou>
  </div>
</template>

<script>
  import Aganippe from '../../editor'
  import aidou from './aidou/aidou.vue'
  import bus from '../bus'
  import { animatedScrollTo } from '../../editor/utils'

  const STANDAR_Y = 320
  const PARAGRAPH_CMD = [
    'ul-bullet', 'ul-task', 'ol-order', 'pre', 'blockquote', 'heading 1', 'heading 2', 'heading 3',
    'heading 4', 'heading 5', 'heading 6', 'upgrade heading', 'degrade heading', 'paragraph', 'hr'
  ]

  export default {
    components: {
      aidou
    },
    props: {
      typewriter: {
        type: Boolean,
        required: true
      },
      focus: {
        type: Boolean,
        required: true
      },
      sourceCode: {
        type: Boolean,
        required: true
      },
      markdown: String,
      cursor: Object,
      theme: String,
      themeCss: Object
    },
    data () {
      return {
        selectionChange: null,
        editor: null,
        pathname: '',
        isShowClose: false,
        dialogTableVisible: false,
        tableChecker: {
          rows: 4,
          columns: 3
        }
      }
    },
    watch: {
      typewriter: function (value) {
        if (value) {
          this.scrollToCursor()
        }
      },
      focus: function (value) {
        this.editor.setFocusMode(value)
      },
      theme: function (value, oldValue) {
        const { editor, themeCss } = this
        if (value !== oldValue && editor) {
          editor.setTheme(value, themeCss[value])
        }
      }
    },
    created () {
      this.$nextTick(() => {
        const ele = this.$refs.editor
        this.editor = new Aganippe(ele)
        const { container } = this.editor
        const { markdown, theme, themeCss } = this
        // init set markdown and edit mode(typewriter mode and focus mode)
        if (markdown.trim()) {
          this.setMarkdownToEditor(markdown)
          if (this.typewriter) {
            this.scrollToCursor()
          }
          this.editor.setFocusMode(this.focus)
        }

        if (theme) {
          this.editor.setTheme(theme, themeCss[theme])
        }

        bus.$on('file-loaded', this.setMarkdownToEditor)
        bus.$on('undo', () => this.editor.undo())
        bus.$on('redo', () => this.editor.redo())
        bus.$on('export', this.handleExport)
        bus.$on('paragraph', this.handleEditParagraph)
        bus.$on('format', this.handleInlineFormat)
        bus.$on('searchValue', this.handleSearch)
        bus.$on('replaceValue', this.handReplace)
        bus.$on('find', this.handleFind)

        this.editor.on('change', (markdown, wordCount, cursor) => {
          this.$store.dispatch('SAVE_FILE', { markdown, wordCount, cursor })
        })

        this.editor.on('selectionChange', changes => {
          const { y } = changes.cursorCoords

          if (this.typewriter) {
            animatedScrollTo(container, container.scrollTop + y - STANDAR_Y, 100)
          }

          this.selectionChange = changes
          this.$store.dispatch('SELECTION_CHANGE', changes)
        })

        this.editor.on('selectionFormats', formats => {
          this.$store.dispatch('SELECTION_FORMATS', formats)
        })
      })
    },
    methods: {
      handleSelect (url) {
        this.editor && this.editor.insertAidou(url)
      },
      handleSearch (value, opt) {
        const searchMatches = this.editor.search(value, opt)
        this.$store.dispatch('SEARCH', searchMatches)
        this.scrollToHighlight()
      },
      handReplace (value, opt) {
        const searchMatches = this.editor.replace(value, opt)
        this.$store.dispatch('SEARCH', searchMatches)
      },
      scrollToCursor () {
        this.$nextTick(() => {
          const { container } = this.editor
          const { y } = this.editor.getSelection().cursorCoords
          animatedScrollTo(container, container.scrollTop + y - STANDAR_Y, 300)
        })
      },
      scrollToHighlight () {
        // Scroll to search highlight word
        const { container } = this.editor
        const anchor = document.querySelector('.ag-highlight')
        if (anchor) {
          const { y } = anchor.getBoundingClientRect()
          const DURATION = 300
          animatedScrollTo(container, container.scrollTop + y - STANDAR_Y, DURATION)
        }
      },
      handleFind (action) {
        const searchMatches = this.editor.find(action)
        this.$store.dispatch('SEARCH', searchMatches)
        this.scrollToHighlight()
      },
      async handleExport (type) {
        switch (type) {
          case 'styledHtml': {
            const content = await this.editor.exportStyledHTML()
            this.$store.dispatch('EXPORT', { type, content })
            break
          }

          case 'html': {
            const content = this.editor.exportUnstylishHtml()
            this.$store.dispatch('EXPORT', { type, content })
            break
          }

          case 'pdf': {
            this.$store.dispatch('EXPORT', { type })
            break
          }
        }
      },
      handleEditParagraph (type) {
        if (type === 'table') {
          this.tableChecker = { rows: 4, columns: 3 }
          this.dialogTableVisible = true
          this.$nextTick(() => {
            this.$refs.rowInput.focus()
          })
        } else if (PARAGRAPH_CMD.indexOf(type) > -1) {
          this.editor && this.editor.updateParagraph(type)
        }
      },
      handleInlineFormat (type) {
        this.editor && this.editor.format(type)
      },
      handleDialogTableConfirm () {
        this.dialogTableVisible = false
        this.editor && this.editor.createTable(this.tableChecker)
      },
      setMarkdownToEditor (markdown) {
        const { cursor } = this
        this.editor && this.editor.setMarkdown(markdown, cursor)
      }
    },
    beforeDestroy () {
      bus.$off('file-loaded', this.setMarkdownToEditor)
      bus.$off('undo', () => this.editor.undo())
      bus.$off('redo', () => this.editor.redo())
      bus.$off('export', this.handleExport)
      bus.$off('paragraph', this.handleEditParagraph)
      bus.$off('format', this.handleInlineFormat)
      bus.$off('searchValue', this.handleSearch)
      bus.$off('replaceValue', this.handReplace)
      bus.$off('find', this.handleFind)

      this.editor.destroy()
      this.editor = null
    }
  }
</script>

<style>
  /*  @import '../../editor/themes/dark.css';*/
  @import '../../editor/index.css';
  .editor-wrapper {
    height: calc(100vh - 22px);
  }
  .editor-wrapper.source {
    position: absolute;
    z-index: -1;
    left: -10000px;
    opacity: 0;
  }
  .editor-component {
    height: 100%;
    overflow: auto;
    box-sizing: border-box;
  }
  .typewriter .editor-component {
    padding-top: calc(50vh - 136px);
    padding-bottom: calc(50vh - 54px);
  }

  .ag-dialog-table {
    box-shadow: none;
  }

  .ag-dialog-table .dialog-title svg {
    width: 1.5em;
    height: 1.5em;
  }
  /* for dark theme */
  .dark.editor-wrapper {
    background: rgb(43, 43, 43);
  }
</style>
