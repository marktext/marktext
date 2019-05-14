<template>
  <div class="pref-image">
    <h4>Image</h4>
    <section class="image-ctrl">
      <div>The default behavior after paste or drag the image to Mark Text</div>
      <el-radio-group v-model="imageDropAction" @change="this.handleImageChange">
        <el-radio label="upload">Upload image to cloud</el-radio>
        <el-radio label="folder">Move image to sepcial folder</el-radio>
      </el-radio-group>
    </section>
    <section class="image-ctrl">
      <div>The default behavior after select image from local folder</div>
      <el-radio-group v-model="imageSelectAction" @change="this.handleImageChange">
        <el-radio label="upload">Upload image to cloud</el-radio>
        <el-radio label="folder">Move image to sepcial folder</el-radio>
        <el-radio label="path">Insert absolute or relative path of image</el-radio>
      </el-radio-group>
    </section>
    <separator></separator>
  </div>
</template>

<script>
import Separator from '../common/separator'

export default {
  components: {
    Separator
  },
  data () {
    return {
    }
  },
  computed: {
    imageDropAction: {
      get: function () {
        return this.$store.state.preferences.imageDropAction
      },
      set: function (value) {
        const type = 'imageDropAction'
        this.$store.dispatch('SET_SINGLE_PREFERENCE', { type, value })
      }
    },
    imageSelectAction: {
      get: function () {
        return this.$store.state.preferences.imageSelectAction
      },
      set: function (value) {
        const type = 'imageSelectAction'
        this.$store.dispatch('SET_SINGLE_PREFERENCE', { type, value })
      }
    }
  },
  methods: {
    handleImageChange (value) {
      // console.log(value)
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
}
</style>


