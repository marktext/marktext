<template>
  <div class="unsaved-changes-dialog">
    <el-dialog
      :visible.sync="visibleProxy"
      :show-close="false"
      :close-on-click-modal="false"
      :close-on-press-escape="!saving"
      custom-class="ag-dialog-table unsaved-dialog"
      width="520px"
      center
    >
      <div class="dialog-copy">
        <div class="eyebrow">Unsaved Changes</div>
        <h3>{{ title }}</h3>
        <p>{{ description }}</p>
      </div>
      <div class="file-list">
        <div
          v-for="file in files"
          :key="file.id"
          class="file-row"
        >
          <div class="file-name">{{ file.filename }}</div>
          <div class="file-path">{{ file.pathname || 'Not saved to disk yet' }}</div>
        </div>
      </div>
      <div slot="footer" class="dialog-footer">
        <el-button
          :disabled="saving"
          @click="resolve('cancel')"
        >
          Cancel
        </el-button>
        <el-button
          :disabled="saving"
          @click="resolve('discard')"
        >
          Don't Save
        </el-button>
        <el-button
          type="primary"
          :loading="saving"
          @click="resolve('save')"
        >
          Save
        </el-button>
      </div>
    </el-dialog>
  </div>
</template>

<script>
import { mapState } from 'vuex'

export default {
  computed: {
    ...mapState({
      dialog: state => state.editor.unsavedConfirmDialog
    }),
    files () {
      return this.dialog.files
    },
    saving () {
      return this.dialog.saving
    },
    title () {
      const count = this.files.length
      return `Save changes to ${count} ${count === 1 ? 'file' : 'files'}?`
    },
    description () {
      if (this.dialog.intent === 'close-window') {
        return 'Your changes will be lost if you close this window without saving.'
      }
      return 'Your changes will be lost if you continue without saving.'
    },
    visibleProxy: {
      get () {
        return this.dialog.visible
      },
      set (value) {
        if (!value && !this.saving) {
          this.$store.dispatch('CLOSE_UNSAVED_CONFIRM_DIALOG')
        }
      }
    }
  },
  methods: {
    resolve (decision) {
      this.$store.dispatch('RESOLVE_UNSAVED_CONFIRM_DIALOG', decision)
    }
  }
}
</script>

<style>
  .unsaved-dialog {
    overflow: hidden;
  }

  .unsaved-dialog .el-dialog__body {
    padding: 10px 20px 8px;
  }

  .unsaved-dialog .dialog-copy {
    margin-bottom: 16px;
    color: var(--floatFontColor);
  }

  .unsaved-dialog .dialog-copy .eyebrow {
    margin-bottom: 8px;
    color: var(--themeColor);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: .08em;
    text-transform: uppercase;
  }

  .unsaved-dialog .dialog-copy h3 {
    margin: 0 0 8px;
    font-size: 22px;
    line-height: 1.2;
  }

  .unsaved-dialog .dialog-copy p {
    margin: 0;
    color: var(--editorColor70);
    line-height: 1.5;
  }

  .unsaved-dialog .file-list {
    max-height: 220px;
    overflow-y: auto;
    padding-right: 4px;
  }

  .unsaved-dialog .file-list::-webkit-scrollbar {
    width: 6px;
  }

  .unsaved-dialog .file-row {
    padding: 12px 14px;
    border: 1px solid var(--floatBorderColor);
    border-radius: 8px;
    background: linear-gradient(180deg, var(--floatBgColor) 0%, var(--editorBgColor) 100%);
  }

  .unsaved-dialog .file-row + .file-row {
    margin-top: 10px;
  }

  .unsaved-dialog .file-name {
    color: var(--floatFontColor);
    font-size: 14px;
    font-weight: 600;
    word-break: break-word;
  }

  .unsaved-dialog .file-path {
    margin-top: 4px;
    color: var(--editorColor60);
    font-size: 12px;
    line-height: 1.4;
    word-break: break-word;
  }

  .unsaved-dialog .dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    padding-top: 8px;
  }
</style>
