<template>
  <div class="aidou">
    <el-dialog
      :visible.sync="showUpload"
      :show-close="false"
      :modal="true"
      custom-class="ag-dialog-table"
      width="400px"
    >
      <el-upload
        ref="uploader"
        class="upload-image"
        drag
        action="https://sm.ms/api/upload"
        name="smfile"
        :multiple="false"
        :limit="1"
        :on-success="handleResponse"
        :before-upload="handleBeforeUpload"
      >
        <i class="el-icon-upload"></i>
        <div class="el-upload__text">Drag image here, or <em>Click</em></div>
        <div class="el-upload__tip" slot="tip" :class="{ 'error': error }">{{ message }}</div>
      </el-upload>
    </el-dialog>
  </div>
</template>

<script>
  import bus from '../../bus'

  const msg = 'jpg | png | gif | jpeg only, max size 5M'

  export default {
    data () {
      return {
        showUpload: false,
        message: msg,
        error: false
      }
    },
    created () {
      this.$nextTick(() => {
        bus.$on('upload-image', this.handleUpload)
      })
    },
    methods: {
      handleBeforeUpload (file) {
        const MAX_SIZE = 5 * 1024 * 1024
        if (!/png|jpg|jpeg|gif/.test(file.type)) {
          this.message = 'jpg | png | gif | jpeg only'
          this.error = true
          return false
        }
        if (file.size > MAX_SIZE) {
          this.message = 'Upload image limit to 5M'
          this.error = true
          return false
        }
        this.message = msg
        this.error = false
      },
      handleUpload () {
        if (!this.showUpload) {
          this.showUpload = true
          bus.$emit('editor-blur')
        }
      },
      handleResponse (res) {
        if (res.code === 'success') {
          // handle success
          const { url, delete: deletionUrl } = res.data
          this.showUpload = false
          bus.$emit('image-uploaded', url, deletionUrl)
        } else if (res.code === 'error') {
          // handle error
          this.message = res.msg
          this.error = true
        }
        this.$refs.uploader.clearFiles()
      }
    }
  }
</script>

<style>
  .el-upload__tip {
    text-align: center;
    color: var(--sideBarColor);
  }
  .el-upload__tip.error {
    color: #E6A23C;
  }
  .el-upload-dragger {
    background: var(--itemBgColor);
    & .el-upload__text {
      color: var(--sideBarColor);
      & em {
        color: var(--themeColor);
      }
    }
  }
  .el-upload-dragger:hover {
    border-color: var(--themeColor);
  }
</style>
