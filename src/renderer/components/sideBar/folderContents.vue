<template>
  <div class="side-bar-folder-contents">
    <folder
      v-for="(childFolder, index) of folder.folders" :key="index + 'folder'"
      :folder="childFolder"
    ></folder>
    <file
      v-for="(file, index) of folder.files" :key="index + 'file'"
      :file="file"
    ></file>  
  </div>
</template>

<script>
  import Folder from './folder.vue'
  import File from './file.vue'

  export default {
    name: 'folder-content',
    props: {
      folder: {
        type: Object,
        required: true
      }
    },
    components: {
      Folder,
      File
    }
  }
</script>

<style scoped>
  .side-bar-folder-contents {
  }
</style>