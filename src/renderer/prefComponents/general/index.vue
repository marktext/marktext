<template>
  <div class="pref-general">
    <h4>General</h4>
    <compound>
    <template #head>
    <bool
      description="Automatically save document changes"
      :bool="autoSave"
      :onChange="value => onSelectChange('autoSave', value)"
    ></bool>
    </template>
    <template #children>
    <range
      description="Delay following document edit before automatically saving"
      :value="autoSaveDelay"
      :min="1000"
      :max="10000"
      unit="ms"
      :step="100"
      :onChange="value => onSelectChange('autoSaveDelay', value)"
    ></range>
    </template>
    </compound>
    <cur-select
      v-if="!isOsx"
      description="Title bar style"
      notes="Requires restart."
      :value="titleBarStyle"
      :options="titleBarStyleOptions"
      :onChange="value => onSelectChange('titleBarStyle', value)"
    ></cur-select>
    <separator></separator>
    <bool
      description="Open files in new window"
      :bool="openFilesInNewWindow"
      :onChange="value => onSelectChange('openFilesInNewWindow', value)"
    ></bool>
    <bool
      description="Open folders in new window"
      :bool="openFolderInNewWindow"
      :onChange="value => onSelectChange('openFolderInNewWindow', value)"
    ></bool>
    <bool
      description="Hide scrollbars"
      :bool="hideScrollbar"
      :onChange="value => onSelectChange('hideScrollbar', value)"
    ></bool>
    <bool
      description="Wrap text in table of contents"
      :bool="wordWrapInToc"
      :onChange="value => onSelectChange('wordWrapInToc', value)"
    ></bool>
    <bool
      description="Use Aidou"
      :bool="aidou"
      :onChange="value => onSelectChange('aidou', value)"
    ></bool>
    <separator></separator>
    <cur-select
      description="Sort field for files in open folders"
      :value="fileSortBy"
      :options="fileSortByOptions"
      :onChange="value => onSelectChange('fileSortBy', value)"
      :disable="true"
    ></cur-select>
    <section class="startup-action-ctrl">
      <div>Action on startup</div>
      <el-radio-group v-model="startUpAction">
        <!--
          Hide "lastState" for now (#2064).
        <el-radio class="ag-underdevelop" label="lastState">Open the last window state</el-radio>
        -->
        <el-radio label="folder">Open the default directory<span>: {{defaultDirectoryToOpen}}</span></el-radio>
        <el-button size="small" @click="selectDefaultDirectoryToOpen">Select Folder</el-button>
        <el-radio label="blank">Open a blank page</el-radio>
      </el-radio-group>
    </section>
    <cur-select
      description="Language for user interface"
      :value="language"
      :options="languageOptions"
      :onChange="value => onSelectChange('language', value)"
      :disable="true"
    ></cur-select>
  </div>
</template>

<script>
import { mapState } from 'vuex'
import Compound from '../common/compound'
import Range from '../common/range'
import CurSelect from '../common/select'
import Bool from '../common/bool'
import Separator from '../common/separator'
import { isOsx } from '@/util'

import {
  titleBarStyleOptions,
  fileSortByOptions,
  languageOptions
} from './config'

export default {
  components: {
    Compound,
    Bool,
    Range,
    CurSelect,
    Separator
  },
  data () {
    this.titleBarStyleOptions = titleBarStyleOptions
    this.fileSortByOptions = fileSortByOptions
    this.languageOptions = languageOptions
    this.isOsx = isOsx
    return {}
  },
  computed: {
    ...mapState({
      autoSave: state => state.preferences.autoSave,
      autoSaveDelay: state => state.preferences.autoSaveDelay,
      titleBarStyle: state => state.preferences.titleBarStyle,
      defaultDirectoryToOpen: state => state.preferences.defaultDirectoryToOpen,
      openFilesInNewWindow: state => state.preferences.openFilesInNewWindow,
      openFolderInNewWindow: state => state.preferences.openFolderInNewWindow,
      hideScrollbar: state => state.preferences.hideScrollbar,
      wordWrapInToc: state => state.preferences.wordWrapInToc,
      aidou: state => state.preferences.aidou,
      fileSortBy: state => state.preferences.fileSortBy,
      language: state => state.preferences.language
    }),
    startUpAction: {
      get: function () {
        return this.$store.state.preferences.startUpAction
      },
      set: function (value) {
        const type = 'startUpAction'
        this.$store.dispatch('SET_SINGLE_PREFERENCE', { type, value })
      }
    }
  },
  methods: {
    onSelectChange (type, value) {
      this.$store.dispatch('SET_SINGLE_PREFERENCE', { type, value })
    },
    selectDefaultDirectoryToOpen () {
      this.$store.dispatch('SELECT_DEFAULT_DIRECTORY_TO_OPEN')
    }
  }
}
</script>

<style scoped>
  .pref-general {
    & .startup-action-ctrl {
      font-size: 14px;
      user-select: none;
      margin: 20px 0;
      color: var(--editorColor);
      & .el-button--small {
        margin-left: 25px;
      }
      & label {
        display: block;
        margin: 20px 0;
      }
    }
  }
</style>
