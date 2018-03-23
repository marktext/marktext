<template>
  <transition name="moveIn">
    <div v-if="isTopDialogShown" id="TopDialog">
      <component :is="dialog"/>
    </div>
  </transition>
</template>

<script>
  import * as dialogs from './dialogs/index'

  export default {
    name: 'TopDialog',
    data () {
      return {}
    },
    props: {
      dialog: String
    },
    computed: {
      isTopDialogShown () {
        return this.$store.state.topDialog != null
      }
    },
    components: dialogs
  }
</script>

<style scoped>
  #TopDialog {
    display: table;
    position: relative;
    top: 0;
    margin: 0 auto;
    padding: 8px;
    background-color: white;
    box-shadow: 0 3px 6px rgba(0, 0, 0, 0.16), 0 3px 6px rgba(0, 0, 0, 0.23);
    border-bottom-left-radius: 4px;
    border-bottom-right-radius: 4px;
    z-index: 2;
  }

  .dark #TopDialog {
    box-shadow: 0 3px 6px rgba(255, 255, 255, 0.16), 0 3px 6px rgba(255, 255, 255, 0.23);
    background-color: rgb(43, 43, 43);
  }

  .moveIn-enter-active, .moveIn-leave-active {
    transition: all .5s cubic-bezier(0.165, 0.84, 0.44, 1);
  }

  .moveIn-enter, .moveIn-leave-to {
    transform: translateY(-125px);
  }
</style>
