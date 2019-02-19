<template>
  <div class="about-dialog" :class="theme">
    <el-dialog
      :visible.sync="showAboutDialog"
      :show-close="false"
      :modal="true"
      custom-class="ag-dialog-table"
      width="400px"
    >
      <img class="logo" src="../../assets/images/logo.png" />
      <el-row>
        <el-col :span="24">
          <h3 class="text fg-color-dark">{{ name }}</h3>
        </el-col>
        <el-col :span="24">
          <div class="text">{{ appVersion }}</div>
        </el-col>
        <el-col :span="24">
          <div class="text">{{ copyright }}</div>
        </el-col>
      </el-row>
    </el-dialog>
  </div>
</template>

<script>
  import { mapState } from 'vuex'
  import bus from '../../bus'

  export default {
    data () {
      this.name = 'Mark Text'
      this.copyright = `Copyright © 2017-${new Date().getFullYear()} Jocs`
      return {
        showAboutDialog: false
      }
    },
    computed: {
      ...mapState({
        'appVersion': state => state.appVersion,
        'theme': state => state.preferences.theme
      })
    },
    created () {
      bus.$on('aboutDialog', this.showDialog)
    },
    beforeDestroy () {
      bus.$off('aboutDialog', this.showDialog)
    },
    methods: {
      showDialog () {
        this.showAboutDialog = true
        bus.$emit('editor-blur')
      }
    }
  }
</script>

<style>
  .about-dialog el-row,
  .about-dialog el-col {
    display: block;
  }

  .about-dialog .logo {
    width: 100px;
    height: 100px;
    display: inherit;
    margin: 0 auto;
  }

  .about-dialog .text {
    text-align: center;
    min-height: 32px;
  }
</style>
