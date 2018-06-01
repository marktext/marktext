<template>
  <div
    :title="file.pathname"
    class="side-bar-file"
    :style="{'padding-left': `${depth * 5 + 15}px`, 'opacity': file.isMarkdown ? 1 : 0.75 }"
  >
    <file-icon
      :name="file.name"
    ></file-icon>
    <span>{{ file.name }}</span>
  </div>
</template>

<script>
  import FileIcon from './icon.vue'

  export default {
    name: 'file',
    props: {
      file: {
        type: Object,
        required: true
      },
      depth: {
        type: Number,
        required: true
      }
    },
    components: {
      FileIcon
    }
  }
</script>

<style scoped>
  .side-bar-file {
    cursor: default;
    user-select: none;
    height: 25px;
    padding-right: 15px;
    &:hover {
      background: var(--extraLightBorder);
    }
  }
</style>
