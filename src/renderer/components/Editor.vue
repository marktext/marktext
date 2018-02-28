<template>
  <div class="editor-wrapper">
    <div ref="editor" class="editor-component"></div>
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
          <use xlink:href="#icon-table"></use>
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
  </div>
</template>

<script>
  import Aganippe from '../../editor'
  import bus from '../bus'

  export default {
    data () {
      return {
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
    created () {
      this.$nextTick(() => {
        const ele = this.$refs.editor
        this.editor = new Aganippe(ele)

        bus.$on('file-loaded', this.handleFileLoaded)
        bus.$on('undo', () => this.editor.undo())
        bus.$on('redo', () => this.editor.redo())
        bus.$on('export', this.handleExport)
        bus.$on('paragraph', this.handleEditParagraph)
        bus.$on('format', this.handleInlineFormat)
        bus.$on('searchValue', this.handleSearch)
        bus.$on('replaceValue', this.handReplace)
        bus.$on('find', this.handleFind)

        this.editor.on('change', (markdown, wordCount) => {
          this.$store.dispatch('SAVE_FILE', { markdown, wordCount })
        })
        this.editor.on('selectionChange', changes => {
          this.$store.dispatch('SELECTION_CHANGE', changes)
        })
        this.editor.on('selectionFormats', formats => {
          this.$store.dispatch('SELECTION_FORMATS', formats)
        })
      })
    },
    methods: {
      handleSearch (value, opt) {
        const searchMatches = this.editor.search(value, opt)
        this.$store.dispatch('SEARCH', searchMatches)
      },
      handReplace (value, opt) {
        const searchMatches = this.editor.replace(value, opt)
        this.$store.dispatch('SEARCH', searchMatches)
      },
      handleFind (action) {
        const searchMatches = this.editor.find(action)
        this.$store.dispatch('SEARCH', searchMatches)
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
        switch (type) {
          case 'table':
            this.tableChecker = { rows: 2, columns: 2 }
            this.dialogTableVisible = true
            this.$nextTick(() => {
              this.$refs.rowInput.focus()
            })
            break
          case 'ul-bullet':
          case 'ul-task':
          case 'ol-order':
          case 'pre':
          case 'blockquote':
          case 'heading 1':
          case 'heading 2':
          case 'heading 3':
          case 'heading 4':
          case 'heading 5':
          case 'heading 6':
          case 'upgrade heading':
          case 'degrade heading':
          case 'paragraph':
          case 'hr':
            this.editor && this.editor.updateParagraph(type)
            break
        }
      },
      handleInlineFormat (type) {
        this.editor && this.editor.format(type)
      },
      handleDialogTableConfirm () {
        this.dialogTableVisible = false
        this.editor && this.editor.createTable(this.tableChecker)
      },
      handleFileLoaded (file) {
        this.editor && this.editor.setMarkdown(file)
      }
    },
    beforeDestroy () {
      bus.$off('file-loaded', this.handleFileLoaded)
      bus.$off('export-styled-html', this.handleExport('styledHtml'))
      bus.$off('paragraph', this.handleEditParagraph)
      bus.$off('searchValue', this.handleSearch)
      bus.$off('find', this.handleFind)
      this.editor = null
    }
  }
</script>

<style>
  @import '../../editor/themes/light.css';
  @import '../../editor/index.css';
  .editor-wrapper {
    height: calc(100vh - 22px);
  }
  .editor-component {
    height: 100%;
    overflow: auto;
  }
  .v-modal {
    background: #fff;
    opacity: .8;
  }
  .ag-dialog-table {
    box-shadow: none;
  }
  .ag-dialog-table .dialog-title svg {
    width: 1.5em;
    height: 1.5em;
  }
</style>
