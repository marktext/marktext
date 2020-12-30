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
        <el-radio label="folder">Move to designated local folder</el-radio>
        <el-radio label="path">Keep original location</el-radio>
      </el-radio-group>
    </section>
    <separator></separator>
    <section class="image-folder">
      <div class="description">Local image folder</div>
      <div class="path">{{imageFolderPath}}</div>
      <div>
        <el-button size="mini" @click="modifyImageFolderPath">Modify</el-button>
        <el-button size="mini" @click="openImageFolder">Open Folder</el-button>
      </div>
      <bool
        description="Prefer relative assets folder"
        more="https://github.com/marktext/marktext/blob/develop/docs/IMAGES.md"
        :bool="imagePreferRelativeDirectory"
        :onChange="value => onSelectChange('imagePreferRelativeDirectory', value)"
      ></bool>
      <text-box
        description="Relative image folder name"
        :input="imageRelativeDirectoryName"
        :regexValidator="/^(?:$|(?![a-zA-Z]:)[^\/\\].*$)/"
        :defaultValue="relativeDirectoryNamePlaceholder"
        :onChange="value => onSelectChange('imageRelativeDirectoryName', value)"
      ></text-box>
    </section>
  </div>
</template>

<script>
import { mapState } from 'vuex'
import { shell } from 'electron'
import Bool from '../common/bool'
import Separator from '../common/separator'
import TextBox from '../common/textBox'

export default {
  components: {
    Bool,
    Separator,
    TextBox
  },
  data () {
    return {
    }
  },
  computed: {
    ...mapState({
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
    imageFolderPath: {
      get: function () {
        return this.$store.state.preferences.imageFolderPath
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
    modifyImageFolderPath () {
      return this.$store.dispatch('SET_IMAGE_FOLDER_PATH')
    },
    onSelectChange (type, value) {
      this.$store.dispatch('SET_SINGLE_PREFERENCE', { type, value })
    }
  }
}
</script>

<style>
.pref-image {
  & h4 {
    text-transform: uppercase;
    margin: 0;
    font-weight: 400;
  }
  & .image-ctrl {
    font-size: 14px;
    margin: 20px 0;
    color: var(--editorColor);
    & label {
      display: block;
      margin: 20px 0;
    }
  }
  & .image-folder {
    & div.description {
      font-size: 14px;
      color: var(--editorColor);
    }
    & div.path {
      font-size: 14px;
      color: var(--editorColor50);
      margin-top: 15px;
      margin-bottom: 15px;
    }
  }
}
</style>
