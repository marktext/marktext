<template>
  <div
    class="markdown-toolbar"
    role="toolbar"
    aria-label="Markdown formatting toolbar"
  >
    <div class="toolbar-group">
      <button
        v-for="item of inlineActions"
        :key="item.value"
        class="toolbar-button"
        type="button"
        :title="item.title"
        @mousedown.prevent
        @click="emitCommand(item)"
      >
        {{ item.label }}
      </button>
    </div>
    <div class="toolbar-group">
      <button
        v-for="item of paragraphActions"
        :key="item.value"
        class="toolbar-button"
        type="button"
        :title="item.title"
        @mousedown.prevent
        @click="emitCommand(item)"
      >
        {{ item.label }}
      </button>
    </div>
    <div class="toolbar-group">
      <button
        class="toolbar-button"
        type="button"
        title="Toggle icon drawer"
        @mousedown.prevent
        @click="$emit('toggle-icon-drawer')"
      >
        Icons
      </button>
    </div>
  </div>
</template>

<script>
const inlineActions = [{
  label: 'B',
  title: 'Bold',
  event: 'format',
  value: 'strong'
}, {
  label: 'I',
  title: 'Italic',
  event: 'format',
  value: 'em'
}, {
  label: 'U',
  title: 'Underline',
  event: 'format',
  value: 'u'
}, {
  label: 'S',
  title: 'Strikethrough',
  event: 'format',
  value: 'del'
}, {
  label: 'Code',
  title: 'Inline Code',
  event: 'format',
  value: 'inline_code'
}, {
  label: 'Math',
  title: 'Inline Math',
  event: 'format',
  value: 'inline_math'
}, {
  label: 'Link',
  title: 'Hyperlink',
  event: 'format',
  value: 'link'
}, {
  label: 'Image',
  title: 'Insert Image',
  event: 'format',
  value: 'image'
}, {
  label: 'Clear',
  title: 'Clear Formatting',
  event: 'format',
  value: 'clear'
}]

const paragraphActions = [{
  label: 'H1',
  title: 'Heading 1',
  event: 'paragraph',
  value: 'heading 1'
}, {
  label: 'H2',
  title: 'Heading 2',
  event: 'paragraph',
  value: 'heading 2'
}, {
  label: 'Quote',
  title: 'Quote Block',
  event: 'paragraph',
  value: 'blockquote'
}, {
  label: 'UL',
  title: 'Bullet List',
  event: 'paragraph',
  value: 'ul-bullet'
}, {
  label: 'OL',
  title: 'Ordered List',
  event: 'paragraph',
  value: 'ol-bullet'
}, {
  label: 'Task',
  title: 'Task List',
  event: 'paragraph',
  value: 'ul-task'
}, {
  label: 'Code Block',
  title: 'Code Fence',
  event: 'paragraph',
  value: 'pre'
}, {
  label: 'Table',
  title: 'Insert Table',
  event: 'paragraph',
  value: 'table'
}, {
  label: 'HR',
  title: 'Horizontal Rule',
  event: 'paragraph',
  value: 'hr'
}]

export default {
  data () {
    return {
      inlineActions,
      paragraphActions
    }
  },
  methods: {
    emitCommand (item) {
      this.$emit(item.event, item.value)
    }
  }
}
</script>

<style scoped>
  .markdown-toolbar {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 10px;
    background: var(--floatBgColor);
    border-bottom: 1px solid var(--editorColor10);
    overflow-x: auto;
    flex: 0 0 auto;
  }

  .toolbar-group {
    display: flex;
    align-items: center;
    gap: 6px;
    flex: 0 0 auto;
  }

  .toolbar-button {
    font-size: 12px;
    line-height: 1;
    color: var(--editorColor80);
    background: transparent;
    border: 1px solid var(--editorColor10);
    border-radius: 4px;
    padding: 6px 8px;
    cursor: pointer;
    white-space: nowrap;
  }

  .toolbar-button:hover {
    color: var(--editorColor);
    border-color: var(--editorColor30);
    background: var(--editorColor04);
  }
</style>
