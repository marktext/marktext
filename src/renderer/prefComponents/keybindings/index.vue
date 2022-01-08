<template>
  <div class="pref-keybindings">
    <h4>Key Bindings</h4>
    <div class="keybinding-info">
      <span>
        MarkText shortcuts can be customized by editing a configuration file named <code>keybindings.json</code>.
        More information how to use custom key bindings can be found <span class="link" @click="openKeybindingsDocumentation">online</span>.
        All changes require a restart.
      </span>

      <separator></separator>
      <el-button size="medium" @click="openKeybindingsFile">Open keybindings.json</el-button>
    </div>
  </div>
</template>

<script>
import { ipcRenderer, shell } from 'electron'
import Compound from '../common/compound'
import Separator from '../common/separator'

export default {
  components: {
    Compound,
    Separator
  },
  data () {
    return {}
  },
  methods: {
    openKeybindingsDocumentation () {
      shell.openExternal('https://github.com/marktext/marktext/blob/master/docs/KEYBINDINGS.md')
    },
    openKeybindingsFile () {
      ipcRenderer.send('mt::open-keybindings-config')
    }
  }
}
</script>

<style scoped>
.pref-keybindings {
  & .keybinding-info {
    font-size: 14px;
    margin: 20px 0;
    color: var(--editorColor);
  }
  & .link {
    color: var(--themeColor);
    cursor: pointer;
  }
  & button.el-button {
    font-size: 13px;
  }
}
</style>
