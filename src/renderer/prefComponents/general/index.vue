<template>
  <div class="pref-general">
    <h4>{{ $t('preferences.general._title') }}</h4>
    <bool
      :description="$t('preferences.general.autoSave')"
      :bool="autoSave"
      :onChange="value => onSelectChange('autoSave', value)"
    ></bool>
    <range
      :description="$t('preferences.general.autoSaveDelay')"
      :value="autoSaveDelay"
      :min="1000"
      :max="10000"
      unit="ms"
      :step="100"
      :onChange="value => onSelectChange('autoSaveDelay', value)"
    ></range>
    <cur-select
      v-if="!isOsx"
      :description="$t('preferences.general.titleBarStyle._title')"
      :value="titleBarStyle"
      :options="titleBarStyleOptions()"
      :onChange="value => onSelectChange('titleBarStyle', value)"
    ></cur-select>
    <separator></separator>
    <bool
      :description="$t('preferences.general.openFilesInNewWindow')"
      :bool="openFilesInNewWindow"
      :onChange="value => onSelectChange('openFilesInNewWindow', value)"
    ></bool>
    <bool
      :description="$t('preferences.general.openFolderInNewWindow')"
      :bool="openFolderInNewWindow"
      :onChange="value => onSelectChange('openFolderInNewWindow', value)"
    ></bool>
    <bool
      :description="$t('preferences.general.hideScrollbar')"
      :bool="hideScrollbar"
      :onChange="value => onSelectChange('hideScrollbar', value)"
    ></bool>
    <bool
      :description="$t('preferences.general.wordWrapInToc')"
      :bool="wordWrapInToc"
      :onChange="value => onSelectChange('wordWrapInToc', value)"
    ></bool>
    <bool
      :description="$t('preferences.general.useAidou')"
      :bool="aidou"
      :onChange="value => onSelectChange('aidou', value)"
    ></bool>
    <separator></separator>
    <cur-select
      :description="$t('preferences.general.fileSortBy._title')"
      :value="fileSortBy"
      :options="fileSortByOptions()"
      :onChange="value => onSelectChange('fileSortBy', value)"
      :disable="true"
    ></cur-select>
    <section class="startup-action-ctrl">
      <div>{{ $t('preferences.general.startUpAction._title') }}</div>
      <el-radio-group v-model="startUpAction">
        <!--
          Hide "lastState" for now (#2064).
        <el-radio class="ag-underdevelop" label="lastState">Open the last window state</el-radio>
        -->
        <el-radio label="folder">{{ $t('preferences.general.startUpAction.folder') }}<span>: {{defaultDirectoryToOpen}}</span></el-radio>
        <el-button size="small" @click="selectDefaultDirectoryToOpen">{{ $t('preferences.general.startUpAction.selectDefaultDirectoryToOpen') }}</el-button>
        <el-radio label="blank">{{ $t('preferences.general.startUpAction.blank') }}</el-radio>
      </el-radio-group>
    </section>
    <cur-select
      :description="$t('preferences.general.languageForUI')"
      :value="language"
      :options="languageOptions"
      :onChange="value => onSelectChange('language', value)"
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
  fileSortByOptions
} from './config'
import { languageOptions } from '../../i18n'

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
    & h4 {
      text-transform: uppercase;
      margin: 0;
      font-weight: 400;
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
