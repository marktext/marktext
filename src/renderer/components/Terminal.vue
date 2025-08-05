# Terminal.vue
<template>
  <div class="terminal-container">
    <div class="terminal-header">
      <span>Terminal</span>
      <button @click="$emit('close')">
        <svg viewBox="0 0 12 12">
          <path d="M1 1l10 10m0-10L1 11" stroke="currentColor" fill="none"/>
        </svg>
      </button>
    </div>
    <EmbeddedTerminal :working-directory="workingDirectory" />
  </div>
</template>

<script>
import EmbeddedTerminal from './EmbeddedTerminal'

export default {
  name: 'Terminal',
  components: {
    EmbeddedTerminal
  },
  props: {
    workingDirectory: {
      type: String,
      required: true
    }
  }
}
</script>

<style>
.terminal-container {
  display: flex;
  flex-direction: column;
  height: 300px;
  border-top: 1px solid var(--editorBorderColor);
}

.terminal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 10px;
  height: 30px;
  background: var(--sideBarBackground);
  border-bottom: 1px solid var(--editorBorderColor);
}

.terminal-header button {
  border: none;
  background: none;
  padding: 5px;
  cursor: pointer;
  outline: none;
}

.terminal-header button:hover {
  color: var(--themeColor);
}

.terminal-header button svg {
  width: 12px;
  height: 12px;
}
</style>
