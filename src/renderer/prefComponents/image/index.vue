<template>
  <div class="pref-image">
    <h4>Image</h4>
    <section class="image-ctrl">
      <div>Default action after image is inserted from local folder or clipboard
        <el-tooltip class='item' effect='dark' content='Clipboard handling is only fully supported on macOS and Windows.' placement='top-start'>
          <i class="el-icon-info"></i>
        </el-tooltip>
      </div>
      <el-radio-group v-model="imageInsertAction">
        <el-radio label="upload">Upload to cloud using selected uploader (must be configured)</el-radio>
        <el-radio label="folder">Copy to designated relative assets or local folder</el-radio>
        <el-radio label="path">Keep original location</el-radio>
      </el-radio-group>
    </section>
    <separator></separator>
    <section class="image-folder">
      <text-box
        description="Local image folder"
        :input="imageFolderPath"
        :regexValidator="/^(?:$|([a-zA-Z]:)?[\/\\].*$)/"
        :defaultValue="folderPathPlaceholder"
        :onChange="value => modifyImageFolderPath(value)"
      ></text-box>
      <div>
        <el-button size="mini" @click="modifyImageFolderPath(undefined)">Open...</el-button>
        <el-button size="mini" @click="openImageFolder">Show in Folder</el-button>
      </div>
    </section>

    <compound>
      <template #head>
        <bool
          description="Prefer relative assets folder"
          more="https://github.com/marktext/marktext/blob/develop/docs/IMAGES.md"
          :bool="imagePreferRelativeDirectory"
          :onChange="value => onSelectChange('imagePreferRelativeDirectory', value)"
        ></bool>
      </template>
      <template #children>
        <text-box
          description="Relative image folder name"
          :input="imageRelativeDirectoryName"
          :regexValidator="/^(?:$|(?![a-zA-Z]:)[^\/\\].*$)/"
          :defaultValue="relativeDirectoryNamePlaceholder"
          :onChange="value => onSelectChange('imageRelativeDirectoryName', value)"
        ></text-box>
      </template>
    </compound>
  </div>
</template>

<script>
import { mapState } from 'vuex'
import { shell } from 'electron'
import Bool from '../common/bool'
import Compound from '../common/compound'
import Separator from '../common/separator'
import TextBox from '../common/textBox'

export default {
  components: {
    Bool,
    Compound,
    Separator,
    TextBox
  },
  data () {
    return {
    }
  },
  computed: {
    ...mapState({
      imageFolderPath: state => state.preferences.imageFolderPath,
      imagePreferRelativeDirectory: state => state.preferences.imagePreferRelativeDirectory,
      imageRelativeDirectoryName: state => state.preferences.imageRelativeDirectoryName
    }),
    imageInsertAction: {
      get: function () {
        return this.$store.state.preferences.imageInsertAction
      },
      set: function (value) {
        const type = 'imageInsertAction'
        this.$store.dispatch('SET_SINGLE_PREFERENCE', { type, value })
      }
    },
    folderPathPlaceholder: {
      get: function () {
        return this.$store.state.preferences.imageFolderPath || ''
      }
    },
    relativeDirectoryNamePlaceholder: {
      get: function () {
        return this.$store.state.preferences.imageRelativeDirectoryName || 'assets'
      }
    }
  },
  methods: {
    openImageFolder () {
      shell.openPath(this.imageFolderPath)
    },
    modifyImageFolderPath (value) {
      return this.$store.dispatch('SET_IMAGE_FOLDER_PATH', value)
    },
    onSelectChange (type, value) {
      this.$store.dispatch('SET_SINGLE_PREFERENCE', { type, value })
    }
  }
}
</script>

<style>
.pref-image {
  & .image-ctrl {
    font-size: 14px;
    margin: 20px 0;
    color: var(--editorColor);
    & label {
      display: block;
      margin: 20px 0;
    }
  }
}
</style>
