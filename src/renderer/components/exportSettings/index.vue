<template>
  <div class="print-settings-dialog">
    <el-dialog
      :visible.sync="showExportSettingsDialog"
      :show-close="false"
      :modal="true"
      custom-class="ag-dialog-table"
      width="500px"
    >
      <h3>{{ $t('dialogs.export._title') }}</h3>
      <el-tabs v-model="activeName">
        <el-tab-pane :label="$t('dialogs.export.info._title')" name="info">
          <span class="text">{{ $t('dialogs.export.info._description') }}</span>
        </el-tab-pane>
        <el-tab-pane :label="$t('dialogs.export.page._title')" name="page">
          <!-- HTML -->
          <div v-if="!isPrintable">
            <text-box
              :description="$t('dialogs.export.page.pageTitle')"
              :input="htmlTitle"
              :emitTime="0"
              :onChange="value => onSelectChange('htmlTitle', value)"
            ></text-box>
          </div>

          <!-- PDF/Print -->
          <div v-if="isPrintable">
            <div v-if="exportType === 'pdf'">
              <cur-select
                class="page-size-select"
                :description="$t('dialogs.export.page.pageSize')"
                :value="pageSize"
                :options="pageSizeList()"
                :onChange="value => onSelectChange('pageSize', value)"
              ></cur-select>
              <div v-if="pageSize === 'custom'" class="row">
                <div>{{ $t('dialogs.export.page.widthOrHeight') }}</div>
                <el-input-number v-model="pageSizeWidth" size="mini" controls-position="right" :min="100"></el-input-number>
                <el-input-number v-model="pageSizeHeight" size="mini" controls-position="right" :min="100"></el-input-number>
              </div>

              <bool
                :description="$t('dialogs.export.page.landscapeOrientation')"
                :bool="isLandscape"
                :onChange="value => onSelectChange('isLandscape', value)"
              ></bool>
            </div>

            <div class="row">
              <div class="description">{{ $t('dialogs.export.page.pageMargin') }}</div>
              <div>
                <div class="label">{{ $t('dialogs.export.page.topOrBottom') }}</div>
                <el-input-number v-model="pageMarginTop" size="mini" controls-position="right" :min="0" :max="100"></el-input-number>
                <el-input-number v-model="pageMarginBottom" size="mini" controls-position="right" :min="0" :max="100"></el-input-number>
              </div>
              <div>
                <div class="label">{{ $t('dialogs.export.page.leftOrRight') }}</div>
                <el-input-number v-model="pageMarginLeft" size="mini" controls-position="right" :min="0" :max="100"></el-input-number>
                <el-input-number v-model="pageMarginRight" size="mini" controls-position="right" :min="0" :max="100"></el-input-number>
              </div>
            </div>
          </div>
        </el-tab-pane>
        <el-tab-pane :label="$t('dialogs.export.style._title')" name="style">
          <bool
            :description="$t('dialogs.export.style.overwriteThemeFonts')"
            :bool="fontSettingsOverwrite"
            :onChange="value => onSelectChange('fontSettingsOverwrite', value)"
          ></bool>
          <div v-if="fontSettingsOverwrite">
            <font-text-box
              :description="$t('dialogs.export.style.fontFamily')"
              :value="fontFamily"
              :onChange="value => onSelectChange('fontFamily', value)"
            ></font-text-box>
            <range
              :description="$t('dialogs.export.style.fontSize')"
              :value="fontSize"
              :min="8"
              :max="32"
              unit="px"
              :step="1"
              :onChange="value => onSelectChange('fontSize', value)"
            ></range>
            <range
              :description="$t('dialogs.export.style.lineHeight')"
              :value="lineHeight"
              :min="1.0"
              :max="2.0"
              :step="0.1"
              :onChange="value => onSelectChange('lineHeight', value)"
            ></range>
          </div>
          <bool
            :description="$t('dialogs.export.style.autoNumberingHeadings')"
            :bool="autoNumberingHeadings"
            :onChange="value => onSelectChange('autoNumberingHeadings', value)"
          ></bool>
          <bool
            :description="$t('dialogs.export.style.showFrontMatter')"
            :bool="showFrontMatter"
            :onChange="value => onSelectChange('showFrontMatter', value)"
          ></bool>
        </el-tab-pane>
        <el-tab-pane :label="$t('dialogs.export.theme._title')" name="theme">
          <div class="text">{{ $t('dialogs.export.theme._description') }}</div>
          <cur-select
            :description="$t('dialogs.export.theme.selectTheme')"
            more="https://github.com/marktext/marktext/blob/develop/docs/EXPORT_THEMES.md"
            :value="theme"
            :options="themeList()"
            :onChange="value => onSelectChange('theme', value)"
          ></cur-select>
        </el-tab-pane>
        <el-tab-pane v-if="isPrintable" :label="$t('dialogs.export.headerAndFooter._title')" name="header">
          <div class="text">{{ $t('dialogs.export.headerAndFooter._description') }}</div>
          <cur-select
            :description="$t('dialogs.export.headerAndFooter.headerType')"
            :value="headerType"
            :options="headerFooterTypes()"
            :onChange="value => onSelectChange('headerType', value)"
          ></cur-select>
          <text-box
            v-if="headerType === 2"
            :description="$t('dialogs.export.headerAndFooter.headerTextLeft')"
            :input="headerTextLeft"
            :emitTime="0"
            :onChange="value => onSelectChange('headerTextLeft', value)"
          ></text-box>
          <text-box
            v-if="headerType !== 0"
            :description="$t('dialogs.export.headerAndFooter.headerTextCenter')"
            :input="headerTextCenter"
            :emitTime="0"
            :onChange="value => onSelectChange('headerTextCenter', value)"
          ></text-box>
          <text-box
            v-if="headerType === 2"
            :description="$t('dialogs.export.headerAndFooter.headerTextRight')"
            :input="headerTextRight"
            :emitTime="0"
            :onChange="value => onSelectChange('headerTextRight', value)"
          ></text-box>

          <cur-select
            :description="$t('dialogs.export.headerAndFooter.footerType')"
            :value="footerType"
            :options="headerFooterTypes()"
            :onChange="value => onSelectChange('footerType', value)"
          ></cur-select>
          <text-box
            v-if="footerType === 2"
            :description="$t('dialogs.export.headerAndFooter.footerTextLeft')"
            :input="footerTextLeft"
            :emitTime="0"
            :onChange="value => onSelectChange('footerTextLeft', value)"
          ></text-box>
          <text-box
            v-if="footerType !== 0"
            :description="$t('dialogs.export.headerAndFooter.footerTextCenter')"
            :input="footerTextCenter"
            :emitTime="0"
            :onChange="value => onSelectChange('footerTextCenter', value)"
          ></text-box>
          <text-box
            v-if="footerType === 2"
            :description="$t('dialogs.export.headerAndFooter.footerTextRight')"
            :input="footerTextRight"
            :emitTime="0"
            :onChange="value => onSelectChange('footerTextRight', value)"
          ></text-box>

          <bool
            :description="$t('dialogs.export.headerAndFooter.customizeStyle')"
            :bool="headerFooterCustomize"
            :onChange="value => onSelectChange('headerFooterCustomize', value)"
          ></bool>

          <div v-if="headerFooterCustomize">
            <bool
              :description="$t('dialogs.export.headerAndFooter.allowStyled')"
              :bool="headerFooterStyled"
              :onChange="value => onSelectChange('headerFooterStyled', value)"
            ></bool>
            <range
              :description="$t('dialogs.export.headerAndFooter.fontSize')"
              :value="headerFooterFontSize"
              :min="8"
              :max="20"
              unit="px"
              :step="1"
              :onChange="value => onSelectChange('headerFooterFontSize', value)"
            ></range>
          </div>
        </el-tab-pane>

        <el-tab-pane :label="$t('dialogs.export.toc._title')" name="toc">
          <bool
            :description="$t('dialogs.export.toc.includeTopHeading')"
            :detailedDescription="$t('dialogs.export.toc.includeTopHeading_description')"
            :bool="tocIncludeTopHeading"
            :onChange="value => onSelectChange('tocIncludeTopHeading', value)"
          ></bool>
          <text-box
            :description="$t('dialogs.export.toc.tocTitle')"
            :input="tocTitle"
            :emitTime="0"
            :onChange="value => onSelectChange('tocTitle', value)"
          ></text-box>
         </el-tab-pane>
      </el-tabs>
      <div class="button-controlls">
        <button class="button-primary" @click="handleClicked">
          {{ $t('dialogs.export.exportBtn') }}
        </button>
      </div>
    </el-dialog>
  </div>
</template>

<script>
import { mapState } from 'vuex'
import fs from 'fs-extra'
import path from 'path'
import { isDirectory, isFile } from 'common/filesystem'
import bus from '../../bus'
import Bool from '@/prefComponents/common/bool'
import CurSelect from '@/prefComponents/common/select'
import FontTextBox from '@/prefComponents/common/fontTextBox'
import Range from '@/prefComponents/common/range'
import TextBox from '@/prefComponents/common/textBox'
import {
  pageSizeList,
  headerFooterTypes,
  headerFooterStyles,
  exportThemeList
} from './exportOptions'

export default {
  components: {
    Bool,
    CurSelect,
    FontTextBox,
    Range,
    TextBox
  },
  data () {
    this.exportType = ''
    this.themesLoaded = false
    this.pageSizeList = pageSizeList
    this.headerFooterTypes = headerFooterTypes
    this.headerFooterStyles = headerFooterStyles
    return {
      isPrintable: true,
      showExportSettingsDialog: false,
      activeName: 'info',
      htmlTitle: '',
      pageSize: 'A4',
      pageSizeWidth: 210,
      pageSizeHeight: 297,
      isLandscape: false,
      pageMarginTop: 20,
      pageMarginRight: 15,
      pageMarginBottom: 20,
      pageMarginLeft: 15,
      fontSettingsOverwrite: false,
      fontFamily: 'Default',
      fontSize: 14,
      lineHeight: 1.5,
      autoNumberingHeadings: false,
      showFrontMatter: false,
      theme: 'default',
      themeList: exportThemeList,
      headerType: 0,
      headerTextLeft: '',
      headerTextCenter: '',
      headerTextRight: '',
      footerType: 0,
      footerTextLeft: '',
      footerTextCenter: '',
      footerTextRight: '',
      headerFooterCustomize: false,
      headerFooterStyled: true,
      headerFooterFontSize: 12,
      tocTitle: '',
      tocIncludeTopHeading: true
    }
  },
  computed: {
    ...mapState({
    })
  },
  created () {
    bus.$on('showExportDialog', this.showDialog)
  },
  beforeDestroy () {
    bus.$off('showExportDialog', this.showDialog)
  },
  methods: {
    showDialog (type) {
      this.exportType = type
      this.isPrintable = type !== 'styledHtml'
      if (!this.isPrintable && (this.activeName === 'header' || this.activeName === 'page')) {
        this.activeName = 'info'
      }

      this.showExportSettingsDialog = true
      bus.$emit('editor-blur')

      if (!this.themesLoaded) {
        this.themesLoaded = true
        this.loadThemesFromDisk()
      }
    },
    handleClicked () {
      const {
        exportType,
        isPrintable,
        htmlTitle,
        pageSize,
        pageSizeWidth,
        pageSizeHeight,
        isLandscape,
        pageMarginTop,
        pageMarginRight,
        pageMarginBottom,
        pageMarginLeft,
        fontSettingsOverwrite,
        fontFamily,
        fontSize,
        lineHeight,
        autoNumberingHeadings,
        showFrontMatter,
        theme,
        headerType,
        headerTextLeft,
        headerTextCenter,
        headerTextRight,
        footerType,
        footerTextLeft,
        footerTextCenter,
        footerTextRight,
        headerFooterCustomize,
        headerFooterStyled,
        headerFooterFontSize,
        tocTitle,
        tocIncludeTopHeading
      } = this
      const options = {
        type: exportType,
        pageSize,
        pageSizeWidth,
        pageSizeHeight,
        isLandscape,
        pageMarginTop,
        pageMarginRight,
        pageMarginBottom,
        pageMarginLeft,
        autoNumberingHeadings,
        showFrontMatter,
        theme: theme === 'default' ? null : theme,
        tocTitle,
        tocIncludeTopHeading
      }

      if (!isPrintable) {
        options.htmlTitle = htmlTitle
      }

      if (fontSettingsOverwrite) {
        Object.assign(options, {
          fontSize,
          lineHeight,
          fontFamily: fontFamily === 'Default' ? null : fontFamily
        })
      }

      if (headerType !== 0) {
        Object.assign(options, {
          header: {
            type: headerType,
            left: headerTextLeft,
            center: headerTextCenter,
            right: headerTextRight
          }
        })
      }

      if (footerType !== 0) {
        Object.assign(options, {
          footer: {
            type: footerType,
            left: footerTextLeft,
            center: footerTextCenter,
            right: footerTextRight
          }
        })
      }

      if (headerFooterCustomize) {
        Object.assign(options, {
          headerFooterStyled,
          headerFooterFontSize
        })
      }

      this.showExportSettingsDialog = false
      bus.$emit('export', options)
    },
    onSelectChange (key, value) {
      this[key] = value
    },
    loadThemesFromDisk () {
      const { userDataPath } = global.marktext.paths
      const themeDir = path.join(userDataPath, 'themes/export')

      // Search for dictionaries on filesystem.
      if (isDirectory(themeDir)) {
        fs.readdirSync(themeDir).forEach(async filename => {
          const fullname = path.join(themeDir, filename)
          if (/.+\.css$/i.test(filename) && isFile(fullname)) {
            try {
              const content = await fs.readFile(fullname, 'utf8')

              // Match comment with theme name in first line only.
              const match = content.match(/^(?:\/\*+[ \t]*([A-z0-9 -]+)[ \t]*(?:\*+\/|[\n\r])?)/)

              let label
              if (match && match[1]) {
                label = match[1]
              } else {
                label = filename
              }

              this.themeList.push({
                value: filename,
                label
              })
            } catch (e) {
              console.error('loadThemesFromDisk failed:', e)
            }
          }
        })
      }
    }
  }
}
</script>

<style scoped>
  .print-settings-dialog {
    user-select: none;
  }
  .row {
    margin-bottom: 8px;
  }
  .description {
    margin-bottom: 10px;
    white-space: pre-wrap;
    word-break: break-word;
  }
  .label {
    margin-bottom: 5px;
  }
  .label ~ div {
    margin-right: 20px;
  }
  .text {
    white-space: pre-wrap;
    word-break: break-word;
  }

  .button-controlls {
    margin-top: 8px;
    text-align: right;
  }

  .button-controlls .button-primary {
    font-size: 14px;
  }

  .el-tab-pane section:first-child {
    margin-top: 0;
  }
</style>
<style>
  .print-settings-dialog #pane-header .pref-text-box-item .el-input {
    width: 90% !important;
  }

  .print-settings-dialog .el-dialog__body {
    padding: 0 20px 20px 20px;
  }
  .print-settings-dialog .pref-select-item .el-select {
    width: 240px;
  }
  .print-settings-dialog .el-tabs__content {
    max-height: 350px;
    overflow-x: hidden;
    overflow-y: auto;
  }

  .print-settings-dialog .el-tabs__content::-webkit-scrollbar:vertical {
    width: 5px;
  }
</style>
