<!-- EmbeddedTerminal.vue -->
<template>
  <div class="embedded-terminal" ref="terminal"></div>
</template>

<script>
import { Terminal } from 'xterm'
import { ipcRenderer } from 'electron'
import 'xterm/css/xterm.css'

export default {
  name: 'EmbeddedTerminal',
  
  props: {
    workingDirectory: {
      type: String,
      required: true
    }
  },

  data() {
    return {
      term: null,
      ptyProcess: null
    }
  },

  mounted() {
    // 初始化 xterm.js
    this.term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'block',
      fontSize: 14,
      fontFamily: 'monospace',
      theme: {
        background: '#1e1e1e',
        foreground: '#ffffff'
      }
    })

    // 打开终端
    this.term.open(this.$refs.terminal)

    // 连接到 node-pty
    this.initializePty()

    // 处理用户输入
    this.term.onData(data => {
      ipcRenderer.send('terminal:input', data)
    })

    // 接收终端输出
    ipcRenderer.on('terminal:output', (event, data) => {
      this.term.write(data)
    })
  },

  beforeDestroy() {
    if (this.term) {
      this.term.dispose()
    }
    ipcRenderer.send('terminal:close')
  },

  methods: {
    initializePty() {
      // 通知主进程创建一个新的伪终端
      ipcRenderer.send('terminal:create', {
        cwd: this.workingDirectory
      })
    }
  }
}
</script>

<style>
.embedded-terminal {
  width: 100%;
  height: 300px;
  background: #1e1e1e;
  padding: 10px;
}
</style>
