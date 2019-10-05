<template>
  <div class="pref-spellchecker">
    <h4>Spell Checker</h4>
    <bool
      description="Whether the experimental spell checker is enabled to check for spelling mistakes."
      :bool="spellcheckerEnabled"
      :onChange="value => onSelectChange('spellcheckerEnabled', value)"
    ></bool>
    <separator></separator>
    <bool
      description="Whether Hunspell or the OS spell checker is used (macOS only). The change take effect after application restart or for new editor windows."
      :bool="spellcheckerIsHunspell"
      :disable="!isOsx || !spellcheckerEnabled"
      :onChange="value => onSelectChange('spellcheckerIsHunspell', value)"
    ></bool>
    <bool
      description="Try to automatically identify the used language when typing. This feature is currently not available on Linux and Windows."
      :bool="spellcheckerAutoDetectLanguage"
      :onChange="value => onSelectChange('spellcheckerAutoDetectLanguage', value)"
    ></bool>
    <cur-select
      description="The spell checker lanugage."
      :value="spellcheckerLanguage"
      :disable="!spellcheckerEnabled"
      :options="spellcheckerDictionaries"
      :onChange="value => onSelectChange('spellcheckerLanguage', value)"
    ></cur-select>
    <div
      v-if="isOsx && spellcheckerIsHunspell"
      class="description"
    >
      Please add the needed language dictionaries via Language & Region in your system preferences pane.
    </div>
    <div v-if="isHunspellSelected && spellcheckerEnabled">
      <separator></separator>
      <el-table
        :data="availableHunspellDictionaries"
        style="width: 100%">
        <el-table-column
          prop="value"
          label="Name"
          width="100">
        </el-table-column>
        <el-table-column
          prop="label"
          label="Language"
        >
        </el-table-column>
        <el-table-column
          fixed="right"
          label="Operations"
          width="170">
          <template slot-scope="scope">
            <el-button @click="handleUpdateClick(scope.$index, scope.row)" type="text" size="small">Update</el-button>
            <el-button @click="handleDeleteClick(scope.$index, scope.row)" type="text" size="small">Delete</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="description">Add new dictionaries to the spell checker.</div>
      <div class="dictionary-group">
        <el-select
          v-model="selectedDictionaryToAdd"
        >
          <el-option
            v-for="item in dictionariesLanguagesOptions"
            :key="item.value"
            :label="item.label"
            :value="item.value">
          </el-option>
        </el-select>
        <el-button icon="el-icon-document-add" @click="addNewDict"></el-button>
      </div>
    </div>
  </div>
</template>

<script>
import { mapState } from 'vuex'
import CurSelect from '../common/select'
import Bool from '../common/bool'
import Separator from '../common/separator'
import { isOsx } from '@/util'
import { getAvailableHunspellDictionaries, SpellChecker } from '@/spellchecker'
import { downloadHunspellDictionary, deleteHunspellDictionary } from '@/spellchecker/dictionaryDownloader'

import {
  DICTIONARIES_LANGUAGES_OPTIONS
} from './config'

export default {
  components: {
    Bool,
    CurSelect,
    Separator
  },
  data () {
    this.isOsx = isOsx
    this.dictionariesLanguagesOptions = DICTIONARIES_LANGUAGES_OPTIONS
    this.hunspellDictionariesDownloadCache = {}
    return {
      availableHunspellDictionaries: [],
      spellcheckerDictionaries: [],
      selectedDictionaryToAdd: 'en-US'
    }
  },
  computed: {
    ...mapState({
      spellcheckerEnabled: state => state.preferences.spellcheckerEnabled,
      spellcheckerIsHunspell: state => state.preferences.spellcheckerIsHunspell,
      spellcheckerAutoDetectLanguage: state => state.preferences.spellcheckerAutoDetectLanguage,
      spellcheckerLanguage: state => state.preferences.spellcheckerLanguage,
      isHunspellSelected: state => {
        return !isOsx || state.preferences.spellcheckerIsHunspell
      }
    })
  },
  watch: {
    spellcheckerIsHunspell: function () {
      if (isOsx) {
        const { spellcheckerLanguage } = this
        const index = DICTIONARIES_LANGUAGES_OPTIONS.findIndex(d => d.value === spellcheckerLanguage)
        if (index === -1) {
          // Language is not supported by Hunspell.
          this.onSelectChange('spellcheckerLanguage', 'en-US')
        }
        this.refreshDictionaryList()
      }
    }
  },
  created () {
    this.$nextTick(() => {
      this.refreshDictionaryList()
    })
  },
  beforeDestroy () {
    if (isOsx && this.spellChecker) {
      this.spellChecker.provider.unsubscribe()
    }
  },
  methods: {
    getAvailableDictionaries () {
      let dictionaries = []
      if (this.isHunspellSelected) {
        // Search hunspell dictionaries on disk.
        dictionaries = getAvailableHunspellDictionaries()
      } else {
        // On macOS we only receive the dictionaries when the spell checker is active.
        if (!this.spellChecker) {
          // Create a new spell checker provider without initializing our instance.
          // This is safe on macOS because we only query the available dictionaries.
          this.spellChecker = new SpellChecker(false)
        }

        // Receive available dictionaries from OS.
        dictionaries = this.spellChecker.getAvailableDictionaries()
      }

      return dictionaries.map(item => {
        return {
          value: item,
          label: DICTIONARIES_LANGUAGES_OPTIONS[item]
        }
      })
    },
    refreshDictionaryList () {
      this.availableHunspellDictionaries = this.getAvailableDictionaries()
      if (this.isHunspellSelected) {
        this.spellcheckerDictionaries = DICTIONARIES_LANGUAGES_OPTIONS
      } else {
        this.spellcheckerDictionaries = this.availableHunspellDictionaries
      }
    },
    onSelectChange (type, value) {
      const needDownloadDict = type === 'spellcheckerLanguage' &&
        this.isHunspellSelected && !this.isHunspellDictionaryAvailable(value)
      if (needDownloadDict) {
        // Download dictionary before changing language.
        this.startDownloadHunspellDictionary(value, error => {
          if (!error) {
            this.availableHunspellDictionaries = this.getAvailableDictionaries()
            this.$store.dispatch('SET_SINGLE_PREFERENCE', { type, value })
          } else {
            // TODO(spell): Handle error
            console.error(error)
          }
        })
      } else {
        this.$store.dispatch('SET_SINGLE_PREFERENCE', { type, value })
      }
    },

    // --- Hunspell only ------------------------------------------------------

    addNewDict () {
      const { selectedDictionaryToAdd } = this
      if (!this.isHunspellDictionaryAvailable(selectedDictionaryToAdd)) {
        this.startDownloadHunspellDictionary(selectedDictionaryToAdd, error => {
          if (!error) {
            this.availableHunspellDictionaries = this.getAvailableDictionaries()
          } else {
            // TODO(spell): Handle error
            console.error(error)
          }
        })
      }
    },
    handleUpdateClick (index, row) {
      this.startDownloadHunspellDictionary(row.value)
    },
    handleDeleteClick (index, row) {
      deleteHunspellDictionary(row.value).then(() => {
        this.availableHunspellDictionaries = this.getAvailableDictionaries()
      }).catch(error => {
        // TODO(spell): Handle error
        console.error(error)
      })
    },

    startDownloadHunspellDictionary (languageCode, callback = null) {
      if (this.hunspellDictionariesDownloadCache[languageCode]) {
        callback(null)
        return
      }

      this.hunspellDictionariesDownloadCache[languageCode] = 1
      downloadHunspellDictionary(languageCode).then(() => {
        delete this.hunspellDictionariesDownloadCache[languageCode]
        if (callback) {
          callback(null)
        }
      }).catch(error => {
        delete this.hunspellDictionariesDownloadCache[languageCode]
        if (callback) {
          callback(error)
        }
      })
    },
    isHunspellDictionaryAvailable (languageCode) {
      const { availableHunspellDictionaries } = this
      return !!availableHunspellDictionaries.find(d => d.languageCode === languageCode)
    }
  }
}
</script>

<style scoped>
  .pref-spellchecker {
    & h4 {
      text-transform: uppercase;
      margin: 0;
      font-weight: 100;
    }
    & div.description {
      margin-top: 10px;
      margin-bottom: 2px;
      color: var(--iconColor);
      font-size: 14px;
    }
  }
  .el-table, .el-table__expanded-cell {
    background: var(--editorBgColor);
  }
  .el-table button {
    padding: 1px 2px;
    margin: 5px 10px;
    color: var(--themeColor);
    background: none;
    border: none;
  }
  .el-table button:hover,
  .el-table button:active {
    opacity: 0.9;
    background: none;
    border: none;
  }
  .dictionary-group {
    display: flex;
    & button.el-button {
      height: 30px;
      width: 30px;
      padding: 0;
      margin-left: 6px;
    }

  }
</style>
<style>
  .pref-spellchecker .el-table table {
    margin: 0;
  }
  .pref-spellchecker .el-table th,
  .pref-spellchecker .el-table tr {
    background: var(--editorBgColor);
  }
  .pref-spellchecker .el-table td,
  .pref-spellchecker .el-table th.is-leaf {
    border: 1px solid var(--tableBorderColor);
  }
  .pref-spellchecker .el-table--border::after,
  .pref-spellchecker .el-table--group::after,
  .pref-spellchecker .el-table::before,
  .pref-spellchecker .el-table__fixed-right::before,
  .pref-spellchecker .el-table__fixed::before {
    background: var(--tableBorderColor);
  }
  .pref-spellchecker .el-table__body tr.hover-row.current-row>td,
  .pref-spellchecker .el-table__body tr.hover-row.el-table__row--striped.current-row>td,
  .pref-spellchecker .el-table__body tr.hover-row.el-table__row--striped>td,
  .pref-spellchecker .el-table__body tr.hover-row>td {
    background: var(--selectionColor);
  }

 .pref-spellchecker li.el-select-dropdown__item {
    color: var(--editorColor);
    height: 30px;
  }
  .pref-spellchecker li.el-select-dropdown__item.hover, li.el-select-dropdown__item:hover {
    background: var(--floatHoverColor);
  }
  .pref-spellchecker div.el-select-dropdown {
    background: var(--floatBgColor);
    border-color: var(--floatBorderColor);
    & .popper__arrow {
      display: none;
    }
  }
  .pref-spellchecker input.el-input__inner {
    height: 30px;
    background: transparent;
    color: var(--editorColor);
    border-color: var(--editorColor10);
  }
  .pref-spellchecker .el-input__icon,
  .pref-spellchecker .el-input__inner {
    line-height: 30px;
  }
</style>
