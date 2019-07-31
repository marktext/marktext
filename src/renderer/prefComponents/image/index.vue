<template>
  <div class="pref-image">
    <h4>Image</h4>
    <section class="image-ctrl">
      <div>The default behavior after insert image from local folder.
        <el-tooltip class='item' effect='dark' content='Mark Text can not get image path from paste event on Linux.' placement='top-start'>
          <i class="el-icon-info"></i>
        </el-tooltip>
      </div>
      <el-radio-group v-model="imageInsertAction">
        <el-radio label="upload">Upload image to cloud by image uploader (you need to select one)</el-radio>
        <el-radio label="folder">Move image to special folder</el-radio>
        <el-radio label="path">Insert absolute or relative path of image</el-radio>
      </el-radio-group>
    </section>
    <separator></separator>
    <section class="image-folder">
      <div class="description">The local image folder.</div>
      <div class="path">{{imageFolderPath}}</div>
      <div>
        <el-button size="mini" @click="modifyImageFolderPath">Modify</el-button>
        <el-button size="mini" @click="openImageFolder">Open Folder</el-button>
      </div>
    </section>
  </div>
</template>

<script>
import Separator from '../common/separator'
import { shell } from 'electron'

export default {
  components: {
    Separator
  },
  data () {
    return {
    }
  },
  computed: {
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
    }
  },
  methods: {
    openImageFolder () {
      shell.openItem(this.imageFolderPath)
    },
    modifyImageFolderPath () {
      return this.$store.dispatch('SET_IMAGE_FOLDER_PATH')
    }
  }
}
</script>

<style>
.pref-image {
  & h4 {
    text-transform: uppercase;
    margin: 0;
    font-weight: 100;
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
