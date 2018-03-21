<template>
  <transition name="moveIn">
    <div v-if="isTopDialogShown" id="TopDialog">
      <div class="wrapper">
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
    </div>
  </transition>
</template>

<script>
  import {mapState} from 'vuex'
  import fs from 'fs'
  const dialog = require('electron').remote.dialog

  export default {
    name: 'TopDialog',
    data () {
      return {}
    },
    computed: {
      ...mapState([
        'isTopDialogShown', 'pathname', 'filename'
      ]),
      filenameWithoutExt () {
        return this.filename.replace(/^(.*)\.[^\\\/]+/, '$1') // eslint-disable-line
      }
    },
    methods: {
      cancel () {
        this.$store.commit('HIDE_TOP_DIALOG')
      },
      rename () {
        var newFileName = document.getElementById('textfield').value + '.md'
        var newPath = this.pathname.replace(/^(.*[\\\/])[^\\\/]+/, '$1' + newFileName) // eslint-disable-line

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
  #TopDialog {
    position: relative;
    top: 0;
    margin: 0 auto;
    width: 450px;
    height: 118px;
    background-color: white;
    box-shadow: 0 3px 6px rgba(0, 0, 0, 0.16), 0 3px 6px rgba(0, 0, 0, 0.23);
    border-bottom-left-radius: 4px;
    border-bottom-right-radius: 4px;
    z-index: 2;
  }

  .moveIn-enter-active, .moveIn-leave-active {
    transition: all .5s cubic-bezier(0.165, 0.84, 0.44, 1);
  }

  .moveIn-enter, .moveIn-leave-to {
    transform: translateY(-125px);
  }

  .wrapper {
    position: absolute;
    top: 8px;
    left: 8px;
    right: 8px;
    bottom: 8px;
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
    padding-left: 8px;
    padding-right: 8px;
  }

  label {
    color: black;
    font-size: 16px;
    height: 20px;
  }

  #textfield {
    box-shadow: inset 0 0 2px 2px #ddd;
  }

  #submit {
    background-color: skyblue;
  }

</style>
