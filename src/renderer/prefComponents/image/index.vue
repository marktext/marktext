<template>
  <div class="pref-image">
    <h4>Image</h4>
    <section class="image-ctrl">
      <div>Default action after image is inserted from local folder or clipboard
        <el-tooltip class='item' effect='dark' content='Clipboard handling is only fully supported on macOS and Windows.' placement='top-start'>
          <i class="el-icon-info"></i>
        </el-tooltip>
      </div>
      <cur-select
        :value="imageInsertAction"
        :options="imageActions"
        :onChange="value => onSelectChange('imageInsertAction', value)"
      ></cur-select>
    </section>

    <separator></separator>
    <section class="image-folder" v-if="imageInsertAction === 'folder' || imageInsertAction === 'path'">
      <h5>Global or relative image Folder</h5>
      <text-box
        description="Global image folder"
        :input="imageFolderPath"
        :regexValidator="/^(?:$|([a-zA-Z]:)?[\/\\].*$)/"
        :defaultValue="folderPathPlaceholder"
        :onChange="value => modifyImageFolderPath(value)"
      ></text-box>
      <div>
        <el-button size="mini" @click="modifyImageFolderPath(undefined)">Open...</el-button>
        <el-button size="mini" @click="openImageFolder">Show in Folder</el-button>
      </div>
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
    </section>
    <Uploader v-if="imageInsertAction === 'upload'" />
  </div>
</template>

<script>
import { mapState } from 'vuex'
import { shell } from 'electron'
import Bool from '../common/bool'
import CurSelect from '../common/select'
import Compound from '../common/compound'
import Separator from '../common/separator'
import TextBox from '../common/textBox'
import Uploader from './components/uploader'
import { imageActions } from './config'

export default {
  components: {
    Bool,
    CurSelect,
    Compound,
    Separator,
    TextBox,
    Uploader
  },
  data () {
    this.imageActions = imageActions

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
