<template>
  <transition name="moveIn">
    <div v-if="isTopDialogShown" id="TopDialog">
      <div class="wrapper">
        <div class="row">
          <input id="textfield" type="text" value="Test">
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
  export default {
    name: 'TopDialog',
    data () {
      return {}
    },
    computed: {
      isTopDialogShown () {
        return this.$store.state.isTopDialogShown
      }
    },
    methods: {
      cancel () {
        this.$store.commit('HIDE_TOP_DIALOG')
      },
      rename () {
        this.$store.commit('HIDE_TOP_DIALOG')
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
    height: 88px;
    background-color: white;
    box-shadow: 0 3px 6px rgba(0, 0, 0, 0.16), 0 3px 6px rgba(0, 0, 0, 0.23);
    border-bottom-left-radius: 4px;
    border-bottom-right-radius: 4px;
    z-index: 2;
  }

  .moveIn-enter-active, .moveIn-leave-active {
    transition: all .5s ease;
  }
  .moveIn-enter, .moveIn-leave-to {
    transform: translateY(-100px);
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

  #textfield {
    box-shadow: inset 0 0 2px 2px #ddd;
  }

  #submit {
    background-color: skyblue;
  }

</style>
