<template>
  <div
    class="side-bar-folder"
  >
    <div
      class="folder-name" @click="folderNameClick"
      :style="{'padding-left': `${depth * 5 + 15}px`}"
      :title="folder.pathname"
    >
      <svg class="icon" aria-hidden="true">
        <use :xlink:href="`#${folder.isCollapsed ? 'icon-folder-close' : 'icon-folder-open'}`"></use>
      </svg>
      <span>{{folder.name}}</span>
    </div>
    <div 
      class="folder-contents"
      v-show="!folder.isCollapsed"
    >
      <folder
        v-for="(childFolder, index) of folder.folders" :key="index + 'folder'"
        :folder="childFolder"
        :depth="depth + 1"
      ></folder>
      <file
        v-for="(file, index) of folder.files" :key="index + 'file'"
        :file="file"
        :depth="depth + 1"
      ></file>  
    </div>
  </div>
</template>

<script>
  export default {
    name: 'folder',
    props: {
      folder: {
        type: Object,
        required: true
      },
      depth: {
        type: Number,
        required: true
      }
    },
    components: {
      File: () => import('./file.vue')
    },
    methods: {
      folderNameClick () {
        this.folder.isCollapsed = !this.folder.isCollapsed
      }
    }
  }
</script>

<style scoped>
  .side-bar-folder {
    & > .folder-name {
      cursor: default;
      user-select: none;
      height: 25px;
      padding-right: 15px;
      & > svg {
        color: rgb(35, 124, 170);
      }
      &:hover {
        background: var(--extraLightBorder);
      }
    }
  }
</style>
