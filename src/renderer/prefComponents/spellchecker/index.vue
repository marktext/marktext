<template>
  <div class="pref-spellchecker">
    <h4>Spelling</h4>
    <compound>
      <template #head>
        <bool
          description="Enable spell checker"
          :bool="spellcheckerEnabled"
          :onChange="handleSpellcheckerEnabled"
        ></bool>
      </template>
      <template #children>
        <bool
          description="Use Hunspell instead of system spell checker on macOS and Windows 10"
          notes="Requires restart."
          :bool="spellcheckerIsHunspell"
          :disable="!isOsSpellcheckerSupported || !spellcheckerEnabled"
          :onChange="value => onSelectChange('spellcheckerIsHunspell', value)"
        ></bool>
        <bool
          description="Hide marks for spelling errors"
          :bool="spellcheckerNoUnderline"
          :disable="!spellcheckerEnabled"
          :onChange="value => onSelectChange('spellcheckerNoUnderline', value)"
        ></bool>
        <bool
          v-show="isOsx && !spellcheckerIsHunspell"
          description="Automatically detect document language (requires showing marks for spelling errors)"
          :bool="spellcheckerAutoDetectLanguage"
          :disable="!spellcheckerEnabled"
          :onChange="value => onSelectChange('spellcheckerAutoDetectLanguage', value)"
        ></bool>
      </template>
    </compound>

    <separator></separator>

    <cur-select
      description="Default language for spell checker"
      :value="spellcheckerLanguage"
      :options="availableDictionaries"
      :disable="!spellcheckerEnabled"
      :onChange="value => onSelectChange('spellcheckerLanguage', value)"
    ></cur-select>
    <div
      v-if="isOsx && !isHunspellSelected && spellcheckerEnabled"
      class="description"
    >
      Additional languages may be added through "Language & Region" in your system preferences pane.
    </div>
    <div
      v-if="isWindows && !isHunspellSelected && spellcheckerEnabled"
      class="description"
    >
      Additional languages may be added through "Language" in your "Time & language" settings.
    </div>

    <div v-if="isHunspellSelected && spellcheckerEnabled">
      <h6 class="title">Hunspell settings:</h6>
      <div class="description">Installed Hunspell dictionaries</div>
      <el-table
        :data="availableDictionaries"
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

      <div class="description">Download additional Hunspell dictionaries</div>
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
      <div v-if="errorMessage" class="description">{{ errorMessage }}</div>
    </div>
  </div>
</template>

<script>
import { mapState } from 'vuex'
import Compound from '../common/compound'
import CurSelect from '../common/select'
import Bool from '../common/bool'
import Separator from '../common/separator'
import { isOsx, isLinux, isWindows, cloneObj } from '@/util'
import { isOsSpellcheckerSupported, getAvailableHunspellDictionaries, SpellChecker } from '@/spellchecker'
import { getLanguageName, HUNSPELL_DICTIONARY_LANGUAGE_MAP } from '@/spellchecker/languageMap'
import { downloadHunspellDictionary, deleteHunspellDictionary } from '@/spellchecker/dictionaryDownloader'

export default {
  components: {
    Bool,
    Compound,
    CurSelect,
    Separator
  },
  data () {
    this.isOsx = isOsx
    this.isLinux = isLinux
    this.isWindows = isWindows
    this.isOsSpellcheckerSupported = isOsSpellcheckerSupported()
    this.dictionariesLanguagesOptions = cloneObj(HUNSPELL_DICTIONARY_LANGUAGE_MAP)
    this.hunspellDictionaryDownloadCache = {}
    return {
      availableDictionaries: [],
      selectedDictionaryToAdd: 'en-US',
      errorMessage: ''
    }
  },
  computed: {
    ...mapState({
      spellcheckerEnabled: state => state.preferences.spellcheckerEnabled,
      spellcheckerIsHunspell: state => state.preferences.spellcheckerIsHunspell,
      spellcheckerNoUnderline: state => state.preferences.spellcheckerNoUnderline,
      spellcheckerAutoDetectLanguage: state => state.preferences.spellcheckerAutoDetectLanguage,
      spellcheckerLanguage: state => state.preferences.spellcheckerLanguage,
      isHunspellSelected: state => {
        return !isOsSpellcheckerSupported() || state.preferences.spellcheckerIsHunspell
      }
    })
  },
  watch: {
    spellcheckerIsHunspell: function (value, oldValue) {
      if (this.isOsSpellcheckerSupported && value !== oldValue) {
        this.ensureDictLanguage(value)
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
    if (!isLinux && this.spellchecker) {
      this.spellchecker.provider.unsubscribe()
    }
  },
  methods: {
    getAvailableDictionaries () {
      let dictionaries = []
      if (this.isHunspellSelected) {
        // Search hunspell dictionaries on disk.
        dictionaries = getAvailableHunspellDictionaries()
      } else {
        // We only receive the dictionaries from OS spell checker via the instance.
        if (!this.spellchecker) {
          // Create a new spell checker provider without attach it.
          this.spellchecker = new SpellChecker()
        }

        // Receive available dictionaries from OS.
        dictionaries = this.spellchecker.getAvailableDictionaries()
      }

      return dictionaries.map(item => {
        return {
          value: item,
          label: getLanguageName(item)
        }
      })
    },
    refreshDictionaryList () {
      this.availableDictionaries = this.getAvailableDictionaries()
    },
    ensureDictLanguage (isHunspell) {
      const { isOsSpellcheckerSupported, spellcheckerLanguage } = this
      if (isHunspell || !isOsSpellcheckerSupported) {
        // Validate language for Hunspell.
        const index = HUNSPELL_DICTIONARY_LANGUAGE_MAP.findIndex(d => d.value === spellcheckerLanguage)
        if (index === -1) {
          // Use fallback because language is not supported by Hunspell.
          this.onSelectChange('spellcheckerLanguage', 'en-US')
        }
      } else {
        // Validate language for OS spellchecker. We only receive the dictionaries from
        // OS spell checker via the instance.
        if (!this.spellchecker) {
          // Create a new spell checker provider without attach it.
          this.spellchecker = new SpellChecker()
        }

        const dicts = this.spellchecker.getAvailableDictionaries()
        const index = dicts.findIndex(d => d === spellcheckerLanguage)
        if (index === -1 && dicts.length >= 1) {
          // Language is not supported, prefer OS language.
          let lang = process.env.LANG
          lang = lang ? lang.split('.')[0] : null
          if (lang) {
            lang = lang.replace(/_/g, '-')
            if (dicts.findIndex(d => d === lang) === -1) {
              lang = null
            }
          }
          this.onSelectChange('spellcheckerLanguage', lang || dicts[0])
        }
      }
    },

    handleSpellcheckerEnabled (value) {
      if (value) {
        const { spellcheckerIsHunspell } = this
        this.ensureDictLanguage(spellcheckerIsHunspell)
      }
      this.onSelectChange('spellcheckerEnabled', value)
    },
    onSelectChange (type, value) {
      this.$store.dispatch('SET_SINGLE_PREFERENCE', { type, value })
    },

    // --- Hunspell only ------------------------------------------------------

    addNewDict () {
      const { selectedDictionaryToAdd } = this
      if (!this.isHunspellDictionaryAvailable(selectedDictionaryToAdd)) {
        this.startDownloadHunspellDictionary(selectedDictionaryToAdd)
      }
    },
    handleUpdateClick (index, row) {
      this.startDownloadHunspellDictionary(row.value)
    },
    handleDeleteClick (index, row) {
      const { spellcheckerLanguage } = this
      const { value: lang } = row

      // Don't allow to delete our fallback language.
      if (lang === 'en-US') {
        return
      }

      // Fallback before deleting selected language.
      if (spellcheckerLanguage === lang) {
        this.onSelectChange('spellcheckerLanguage', 'en-US')
      }

      deleteHunspellDictionary(lang)
        .then(() => {
          this.refreshDictionaryList()
        }).catch(error => {
          this.errorMessage = `Error deleting dictionary: ${error.message}`
        })
    },

    startDownloadHunspellDictionary (languageCode) {
      this.errorMessage = ''
      if (this.hunspellDictionaryDownloadCache[languageCode]) {
        return
      } else if (!navigator.onLine) {
        delete this.hunspellDictionaryDownloadCache[languageCode]
        this.errorMessage = 'No Internet connection available.'
        return
      }

      this.hunspellDictionaryDownloadCache[languageCode] = 1
      downloadHunspellDictionary(languageCode)
        .then(() => {
          delete this.hunspellDictionaryDownloadCache[languageCode]
          this.refreshDictionaryList()
        }).catch(error => {
          delete this.hunspellDictionaryDownloadCache[languageCode]
          this.errorMessage = `Error while downloading: ${error.message}`
        })
    },
    isHunspellDictionaryAvailable (languageCode) {
      const { availableDictionaries } = this
      return availableDictionaries.findIndex(d => d.value === languageCode) !== -1
    }
  }
}
</script>

<style scoped>
  .pref-spellchecker {
    & div.description {
      margin-top: 10px;
      margin-bottom: 2px;
      color: var(--iconColor);
      font-size: 14px;
    }
    & h6.title {
      font-weight: 400;
      font-size: 1.1em;
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
