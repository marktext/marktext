<template>
  <div class="user-notification-dialog">
    <el-dialog
      :visible.sync="showUserNotificationDialog"
      :show-close="true"
      :modal="true"
      custom-class="ag-dialog-table"
      width="400px"
    >
      <h3>{{ title }}</h3>
      <span class="text">{{ message }}</span>
    </el-dialog>
  </div>
</template>

<script>
import bus from '../../bus'

export default {
  data () {
    this.title = ''
    this.message = ''

    return {
      showUserNotificationDialog: false
    }
  },
  created () {
    require('electron').ipcRenderer.on('showUserNotificationDialog', this.showDialog)
  },
  beforeDestroy () {
    require('electron').ipcRenderer.off('showUserNotificationDialog', this.showDialog)
  },
  methods: {
    showDialog (e, title, message) {
      this.title = title
      this.message = message
      this.showUserNotificationDialog = true
      bus.$emit('editor-blur')
    }
  }
}
</script>

<style scoped>
  .text {
    white-space: pre-wrap;
    word-break: break-word;
  }
</style>
