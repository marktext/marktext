<template>
    <div class="side-bar-list-file">
      <div class="title">
        <span class="filename">{{ filename }}</span>
        <span>{{ extension }}</span>
      </div>
      <div class="folder-date">
        <span class="folder">{{parent}}</span>
        <span class="birth-time">{{ new Date(file.birthTime).toLocaleString().split(/\s/)[0] }}</span>
      </div>
      <div class="content">
        {{ file.data.markdown.substring(0, 50) }}
      </div>
    </div>
</template>

<script>
  export default {
    props: {
      file: {
        type: Object,
        required: true
      }
    },
    computed: {
      filename () {
        return this.file.name.split('.')[0]
      },
      extension () {
        return `.${this.file.name.split('.')[1]}`
      },
      parent () {
        return this.file.pathname.match(/(?:^|\/)([^/]+)\/[^/]+\.[^/]+$/)[1] + '/'
      }
    }
  }
</script>

<style scoped>
  .side-bar-list-file {
    user-select: none;
    padding: 10px 20px;
    color: var(--secondaryColor);
    font-size: 13px;
    & .title .filename {
      font-size: 15px;
      color: var(--primaryColor);
    }
    &:hover {
      background: var(--extraLightBorder);
    }
  }
  .folder-date {
    margin-top: 5px;
    display: flex;
    justify-content: space-between;
  }
  .content {
    width: 100%;
    margin-top: 5px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
