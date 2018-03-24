<template>
  <div class="rename" :class="theme">
    <el-dialog 
      :visible.sync="showRename"
      :show-close="false"
      :modal="true"
      custom-class="ag-dialog-table"
      width="410px"
    
    >
      <div slot="title" class="search-wrapper">
        <div class="input-wrapper">
          <input
            type="text" v-model="tempName" class="search"
            @keyup.13="confirm"
            ref="search"
          >
          <svg class="icon" aria-hidden="true" @click="confirm">
            <use xlink:href="#icon-markdown"></use>
          </svg>        
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script>
  import bus from '../bus'
  import { mapState } from 'vuex'

  export default {
    data () {
      return {
        showRename: false,
        tempName: ''
      }
    },
    created () {
      this.$nextTick(() => {
        bus.$on('rename', this.handleRename)
      })
    },
    beforeDestroy () {
      bus.$off('rename', this.handleRename)
    },
    computed: {
      ...mapState([
        'filename', 'theme'
      ])
    },
    methods: {
      handleRename () {
        this.showRename = true
        this.tempName = this.filename
        this.$refs.search.focus()
      },
      confirm () {
        this.$store.dispatch('RENAME', this.tempName)
        this.showRename = false
      }
    }
  }
</script>

<style scoped>
  .el-dialog__header {
    margin-bottom: 20px;
  }
  .search-wrapper {
    margin-top: 8px;
    z-index: 10000;
    position: absolute;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 410px;
    margin: 0 auto;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    align-items: center;
    height: auto;
    padding: 5px;
    background: #fff;
    box-shadow: 0 3px 8px rgba(0, 0, 0, .1);
    border: 1px solid #eeeeee;
    border-radius: 3px;
  }
  .input-wrapper {
    display: flex;
    width: 100%;
  }
  .search {
    width: 100%;
    height: 30px;
    outline: none;
    border: none;
    font-size: 14px;
    padding: 0 8px;
    margin: 0 10px;
    color: #606266;
  }
  .search-wrapper svg {
    cursor: pointer;
    margin: 0 5px;
    width: 30px;
    height: 30px;
    color: #606266;
    transition: all .3s ease-in-out;
  }
  .search-wrapper svg:hover {
    color: orange;
  }

  /* style for dark theme */
  .dark .search-wrapper {
    background: rgb(75, 75, 75);
    border-color: rgb(75, 75, 75);
  }

</style>
