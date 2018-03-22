<template>
  <div id="RenameDialog">
    <div class="row">
      <label>Rename file</label>
    </div>
    <div class="row">
      <input id="textfield" type="text" :value="filenameWithoutExt">
    </div>
    <div class="row">
      <input id="submit" type="button" value="Rename" v-on:click="rename">
      <input id="cancel" type="button" value="Cancel" v-on:click="cancel">
    </div>
  </div>
</template>

<script>
  import {mapState} from 'vuex'
  import fs from 'fs'
  import path from 'path'
  const dialog = require('electron').remote.dialog

  export default {
    name: 'RenameDialog',
    data () {
      return {}
    },
    computed: {
      ...mapState([
        'pathname', 'filename'
      ]),
      filenameWithoutExt () {
        return path.basename(this.filename, '.md')
      }
    },
    methods: {
      cancel () {
        this.$store.commit('HIDE_TOP_DIALOG')
      },
      rename () {
        var newFileName = document.getElementById('textfield').value + '.md'
        var newPath = path.dirname(this.pathname) + path.sep + newFileName // eslint-disable-line

        if (!fs.existsSync(newPath)) {
          fs.renameSync(this.pathname, newPath)
          this.$store.commit('SET_FILENAME', newFileName)
          this.$store.commit('SET_PATHNAME', newPath)
          this.$store.commit('HIDE_TOP_DIALOG')
        } else {
          dialog.showMessageBox({
            type: 'warning',
            buttons: ['Replace', 'Cancel'],
            defaultId: 1,
            message: `The file ${this.pathname} already exists. Do you want to replace it?`,
            cancelId: 1,
            noLink: true
          }, index => {
            if (index === 0) {
              fs.renameSync(this.pathname, newPath)
              this.$store.commit('SET_FILENAME', newFileName)
              this.$store.commit('SET_PATHNAME', newPath)
              this.$store.commit('HIDE_TOP_DIALOG')
            }
          })
        }
      }
    }
  }
</script>

<style scoped>
  #RenameDialog {
    height: 98px;
    width: 450px;
  }

  .row {
    display: flex;
    flex-direction: row;
    align-items: stretch;
    margin-left: -8px;
  }

  .row * {
    flex: 1;
    margin-left: 8px;
  }

  .row + .row {
    margin-top: 8px;
  }

  input {
    color: black;
    border: 0;
    box-shadow: none;
    border-radius: 4px;
    outline: none;
    background: #EEE none;
    height: 32px;
    font-size: 16px;
    padding: 0 8px;
  }

  input[type="button"] {
    cursor: pointer;
  }

  label {
    color: black;
    font-size: 16px;
    line-height: 18px;
  }

  #textfield {
    box-shadow: inset 0 0 2px 2px #ddd;
  }

  #submit {
    background-color: skyblue;
  }
</style>