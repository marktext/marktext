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
          <div class="text">{{ versionPrefix }}{{ appVersion }}</div>
        </el-col>
        <el-col :span="24">
          <div class="text">Copyright © 2018 Jocs</div>
        </el-col>
      </el-row>
  </div>
</template>

<script>
  import { mapState } from 'vuex'
  import bus from '../../bus'

  export default {
    data () {
      return {
        showAboutDialog: false,
        name: 'Mark Text',
        versionPrefix: 'v'
      }
    },
    computed: {
      ...mapState([
        'appVersion',
        'theme'
      ])
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
    display: inherit;
    margin: 0 auto;
  }

  .about-dialog .text {
    text-align: center;
    min-height: 32px;
  }
</style>
