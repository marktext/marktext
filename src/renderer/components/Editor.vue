<template>
  <div>
    <div ref="editor" class="editor-component"></div>
    <el-dialog 
      title="Insert Table"
      :visible.sync="dialogTableVisible"
      :show-close="isShowClose"
      :modal="false"
      custom-class="ag-dialog-table"
      width="450px"
    >
      <el-form :model="tableChecker" :inline="true">
        <el-form-item label="Rows">
          <el-input-number
            size="mini" v-model="tableChecker.rows"
            controls-position="right"
            :min="2"
            :max="20"
          ></el-input-number>
        </el-form-item>
        <el-form-item label="Columns">
          <el-input-number
            size="mini" v-model="tableChecker.columns"
            controls-position="right"
            :min="2"
            :max="20"
          ></el-input-number>
        </el-form-item>
      </el-form>
      <div slot="footer" class="dialog-footer">
        <el-button @click="dialogTableVisible = false" size="mini">Cancel</el-button>
        <el-button type="primary" @click="handleDialogTableConfirm" size="mini">Ok</el-button>
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
          rows: 2,
          columns: 2
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

        this.editor.on('change', (markdown, wordCount) => {
          this.$store.dispatch('SAVE_FILE', { markdown, wordCount })
        })
        this.editor.on('selectionChange', changes => {
          this.$store.dispatch('SELECTION_CHANGE', changes)
        })
      })
    },
    methods: {
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
        }
      },
      handleEditParagraph (type) {
        console.log(type)
        switch (type) {
          case 'table':
            this.tableChecker = { rows: 2, columns: 2 }
            this.dialogTableVisible = true
            break
          case 'heading 1':
          case 'heading 2':
          case 'heading 3':
          case 'heading 4':
          case 'heading 5':
          case 'heading 6':
          case 'upgrade heading':
          case 'degrade heading':
          case 'paragraph':
            this.editor && this.editor.updateParagraph(type)
            break
        }
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
      this.editor = null
    }
  }
</script>

<style>
  @import '../../editor/themes/github.css';
  @import '../../editor/index.css';
  .editor-component {
    height: calc(100vh - 22px);
    overflow: auto;
  }
  .ag-dialog-table {
    background: rgb(239, 239, 239);
  }
</style>
