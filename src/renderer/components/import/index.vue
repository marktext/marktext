<template>
  <div class="import-dialog">
    <el-dialog
      :visible.sync="showImport"
      :show-close="false"
      :modal="true"
      custom-class="ag-dialog-table"
      width="450px"
    >
      <div class="body">
        <div
          class="drop-container"
          :class="{active: isOver}"
          @dragover="dragOverHandler"
          @dragleave="dragLeaveHandler"
          @drop="dropHandler"
        >
          <div class="img-wrapper">
            <img :src="`${importIcon.url}`" alt="import file">
          </div>
          <div>Import or Open</div>
          <p> Drop here to get you stuff into Mark Text</p>
        </div>
        <div class="file-list">
          <div>.md</div>
          <div>.html</div>
          <div>.docx</div>
          <div>.tex</div>
          <div>.wiki</div>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script>
import bus from '@/bus'
import { ipcRenderer } from 'electron'
import importIcon from '@/assets/icons/import_file.svg'

export default {
  data () {
    this.importIcon = importIcon
    return {
      showImport: false,
      isOver: false
    }
  },
  created () {
    bus.$on('importDialog', this.showDialog)
  },
  beforeDestroy () {
    bus.$off('importDialog', this.showDialog)
  },
  methods: {
    showDialog (boolean) {
      if (boolean !== this.showImport) {
        this.showImport = boolean
      }
    },
    dragOverHandler (e) {
      this.isOver = true
    },
    dragLeaveHandler (e) {
      this.isOver = false
    },
    dropHandler (e) {
      e.preventDefault()
      if (e.dataTransfer.files) {
        const fileList = []
        for (const file of e.dataTransfer.files) {
          fileList.push(file.path)
        }
        ipcRenderer.send('AGANI::window::drop', fileList)
      }
    }
  }
}
</script>

<style scoped>
.drop-container {
  border-radius: 5px;
  color: var(--sideBarColor);
  border: 1px dashed var(--sideBarTextColor);
  & div,
  & p {
    text-align: center;
  }
  &.active {
    border: 1px dashed var(--themeColor);
    background-color: var(--itemBgColor);
  }
}
.img-wrapper {
  width: 50px;
  height: 70px;
  margin: 40px auto 0 auto;
  & img {
    width: 100%;
    height: 100%;
  }
}
.file-list {
  margin-top: 20px;
  display: flex;
  justify-content: space-between;
  & div {
    width: 70px;
    height: 70px;
    border: 1px solid var(--sideBarTextColor);
    border-radius: 3px;
    text-align: center;
    font-size: 18px;
    line-height: 70px;
    color: var(--sideBarTitleColor);
  }
}
</style>
