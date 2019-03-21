<template>
  <div class="font">
    <el-dialog 
      :visible.sync="showFontSetting"
      :show-close="false"
      :modal="false"
      custom-class="ag-dialog-table"
      width="400px"
    >
      <div slot="title">
        <el-color-picker
          v-model="tempColor"
          size="small"
          @active-change="colorChange"
        ></el-color-picker>
        <svg class="icon" aria-hidden="true" :style="{ 'color': tempColor }">
          <use xlink:href="#icon-font"></use>
        </svg> 
      </div>
      <div class="row">
        <div class="label">
          <svg class="icon" aria-hidden="true">
            <use xlink:href="#icon-fontsize"></use>
          </svg>       
        </div>
        <el-slider v-model="tempSize" :format-tooltip="formatSize" :min="12" :max="30" :step="1"
          @change="sizeChange"
        ></el-slider>
      </div>
      <div class="row">
        <div class="label">
          <svg class="icon" aria-hidden="true">
            <use xlink:href="#icon-lineheight"></use>
          </svg>        
        </div>
        <el-slider v-model="tempHeight" :format-tooltip="formatHeight" :min="1" :max="3" :step="0.1"
          @change="heightChange"
        ></el-slider>
      </div>
    </el-dialog>
  </div>
</template>

<script>
  import { mapState } from 'vuex'
  import bus from '../bus'

  export default {
    data () {
      return {
        showFontSetting: false,
        tempSize: 16,
        tempColor: '',
        tempHeight: 1.6
      }
    },
    computed: {
      ...mapState({
        'fontSize': state => state.preferences.fontSize,
        'lightColor': state => state.preferences.lightColor,
        'darkColor': state => state.preferences.darkColor,
        'lineHeight': state => state.preferences.lineHeight
      }),
      defaultSize () {
        return parseInt(this.fontSize, 10)
      }
    },
    created () {
      this.$nextTick(() => {
        bus.$on('font-setting', this.handleFontSetting)
      })
    },
    beforeDestroy () {
      bus.$off('font-setting', this.handleFontSetting)
    },
    methods: {
      handleFontSetting () {
        this.showFontSetting = true
        const { darkColor, lightColor, theme, lineHeight } = this
        this.tempSize = this.defaultSize
        this.tempColor = theme === 'dark' ? darkColor : lightColor
        this.tempHeight = +lineHeight
      },
      formatSize (val) {
        return `${val} px`
      },
      formatHeight (val) {
        return `${val}`
      },
      colorChange (color) {
        const COLOR_KEY = this.theme === 'dark' ? 'darkColor' : 'lightColor'
        this.handleChange(COLOR_KEY)(color)
      },
      sizeChange (size) {
        this.handleChange('fontSize')(size)
      },
      heightChange (height) {
        this.handleChange('lineHeight')(height)
      },
      handleChange (type) {
        return (value) => {
          if (!value) return
          if (type === 'fontSize') value = value + 'px'
          this.$store.dispatch('CHANGE_FONT', { type, value })
        }
      }
    }
  }
</script>

<style>
  .font .el-color-picker__trigger {
    position: absolute;
    top: 6px;
    opacity: 0;
  }
  .font .el-dialog__header {
    padding-top: 10px;
    text-align: center;
  }
  .font svg.icon {
    width: 1.5em;
    height: 1.5em;
  }
  .font .row .label {
    display: inline-block;
    width: 50px;
    height: 38px;
    line-height: 38px;
    vertical-align: text-bottom;
  }
  .font .row .el-slider {
    width: 300px;
    display: inline-block;
  }
</style>
