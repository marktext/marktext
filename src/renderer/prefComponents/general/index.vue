<template>
  <div class="pref-general">
    <h4>General</h4>
    <bool
      description="Automatically save the content being edited"
      :bool="autoSave"
      :onChange="value => onSelectChange('autoSave', value)"
    ></bool>
    <range
      description="How long do you want to save your document?"
      :value="autoSaveDelay"
      :min="1000"
      :max="10000"
      unit="ms"
      :step="100"
      :onChange="value => onSelectChange('autoSaveDelay', value)"
    ></range>
    <cur-select
      v-if="!isOsx"
      description="The title bar style, frameless or not. (You need to restart Mark Text to enable it)"
      :value="titleBarStyle"
      :options="titleBarStyleOptions"
      :onChange="value => onSelectChange('titleBarStyle', value)"
    ></cur-select>
    <separator></separator>
    <bool
      description="Open file in new window"
      :bool="openFilesInNewWindow"
      :onChange="value => onSelectChange('openFilesInNewWindow', value)"
    ></bool>
    <bool
      description="Enable Aidou"
      :bool="aidou"
      :onChange="value => onSelectChange('aidou', value)"
    ></bool>
    <separator></separator>
    <cur-select
      description="Sort files in opened folder by created time modified time and title"
      :value="fileSortBy"
      :options="fileSortByOptions"
      :onChange="value => onSelectChange('fileSortBy', value)"
      :disable="true"
    ></cur-select>
    <section class="startup-action-ctrl">
      <div>The action after Mark Text startup, open the last edited content, open the specified folder or blank page</div>
      <el-radio class="ag-underdevelop" v-model="startUpAction" label="lastState">Open the last window state</el-radio>
      <el-radio v-model="startUpAction" label="folder">Open a default directory</el-radio>
      <el-button size="small" @click="selectDefaultDirectoryToOpen">Select Folder</el-button>
      <el-radio v-model="startUpAction" label="blank">Open blank page</el-radio>
    </section>
    <cur-select
      description="The language Mark Text use"
      :value="language"
      :options="languageOptions"
      :onChange="value => onSelectChange('language', value)"
      :disable="true"
    ></cur-select>
  </div>
</template>

<script>
import { mapState } from 'vuex'
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
      openFilesInNewWindow: state => state.preferences.openFilesInNewWindow,
      aidou: state => state.preferences.aidou,
      fileSortBy: state => state.preferences.fileSortBy,
      startUpAction: state => state.preferences.startUpAction,
      language: state => state.preferences.language
    })
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
    & h4 {
      text-transform: uppercase;
      margin: 0;
      font-weight: 100;
    }
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
