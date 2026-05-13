<template>
  <div class="pref-spellchecker">
    <h4>{{ t('preferences.spellchecker.title') }}</h4>
    <compound>
      <template #head>
        <bool
          :description="t('preferences.spellchecker.enableSpellChecking')"
          :bool="spellcheckerEnabled"
          :on-change="handleSpellcheckerEnabled"
        />
      </template>
      <template #children>
        <bool
          :description="t('preferences.spellchecker.hideMarksForErrors')"
          :bool="spellcheckerNoUnderline"
          :disable="!spellcheckerEnabled"
          :on-change="(value) => onSelectChange('spellcheckerNoUnderline', value)"
        />
        <bool
          v-show="isOsx"
          :description="t('preferences.spellchecker.autoDetectLanguage')"
          :bool="true"
          :disable="true"
        />
        <cur-select
          v-show="!isOsx"
          :description="t('preferences.spellchecker.defaultLanguage')"
          :value="spellcheckerLanguage"
          :options="availableDictionaries"
          :disable="!spellcheckerEnabled"
          :on-change="handleSpellcheckerLanguage"
        />
      </template>
    </compound>

    <div
      v-if="isOsx && spellcheckerEnabled"
      class="description"
    >
      {{ t('preferences.spellchecker.autoDetectDescription') }}
    </div>

    <div v-if="!isOsx && spellcheckerEnabled">
      <h6 class="title">
        {{ t('preferences.spellchecker.customDictionary.title') }}
      </h6>
      <div class="description">
        {{ t('preferences.spellchecker.customDictionary.description') }}
      </div>
      <el-table
        :data="wordsInCustomDictionary"
        :empty-text="t('preferences.spellchecker.customDictionary.noWordsAvailable')"
        style="width: 100%"
      >
        <el-table-column
          prop="word"
          :label="t('preferences.spellchecker.customDictionary.word')"
        />

        <el-table-column
          fixed="right"
          :label="t('preferences.spellchecker.customDictionary.options')"
          width="90"
        >
          <template #default="scope">
            <el-button
              type="text"
              size="small"
              :title="t('preferences.spellchecker.customDictionary.delete')"
              @click="handleDeleteClick(scope.row)"
            >
              <Delete
                width="16"
                height="16"
              />
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script setup>
import log from 'electron-log'
import { usePreferencesStore } from '@/store/preferences'
import { ref, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import Compound from '../common/compound'
import CurSelect from '../common/select'
import Bool from '../common/bool'
import { isOsx as checkIsOsx } from '@/util'
import { SpellChecker } from '@/spellchecker'
import { getLanguageName } from '@/spellchecker/languageMap'
import notice from '@/services/notification'
import { useI18n } from 'vue-i18n'
import { Delete } from '@element-plus/icons-vue'

const { t } = useI18n()
const isOsx = checkIsOsx
const availableDictionaries = ref([])
const wordsInCustomDictionary = ref([])

const preferenceStore = usePreferencesStore()

const { spellcheckerEnabled, spellcheckerNoUnderline, spellcheckerLanguage } =
  storeToRefs(preferenceStore)

onMounted(async () => {
  if (isOsx) {
    return
  }

  availableDictionaries.value = await getAvailableDictionaries()

  window.electron.ipcRenderer
    .invoke('mt::spellchecker-get-custom-dictionary-words')
    .then((words) => {
      wordsInCustomDictionary.value = words.map((word) => {
        return { word }
      })
    })
})

const getAvailableDictionaries = async () => {
  const dictionaries = await SpellChecker.getAvailableDictionaries()

  return dictionaries.map((selectedItem) => {
    return {
      value: selectedItem,
      label: getLanguageName(selectedItem)
    }
  })
}

const handleSpellcheckerLanguage = async (languageCode) => {
  onSelectChange('spellcheckerLanguage', languageCode)

  await window.electron.ipcRenderer.invoke('mt::spellchecker-switch-language', languageCode)
}

const handleSpellcheckerEnabled = (isEnabled) => {
  onSelectChange('spellcheckerEnabled', isEnabled)
}

const onSelectChange = (type, value) => {
  preferenceStore.SET_SINGLE_PREFERENCE({ type, value })
}

const handleDeleteClick = (selectedItem) => {
  if (selectedItem && typeof selectedItem.word === 'string') {
    window.electron.ipcRenderer
      .invoke('mt::spellchecker-remove-word', selectedItem.word)
      .then((success) => {
        if (success) {
          wordsInCustomDictionary.value = wordsInCustomDictionary.value.filter(
            (item) => item.word !== selectedItem.word
          )
        } else {
          notice.notify({
            title: t('spellchecker.failedToRemoveWord'),
            type: 'error',
            message: t('spellchecker.unexpectedError')
          })
        }
      })
      .catch((error) => log.error(error))
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
    margin-bottom: 0;
  }
}
.el-table,
.el-table__expanded-cell {
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
</style>
<style>
.pref-spellchecker .el-table table {
  margin: 0;
  border: none;
}
.pref-spellchecker .el-table th,
.pref-spellchecker .el-table tr {
  background: var(--editorBgColor);
}
.pref-spellchecker .el-table th.el-table__cell.is-leaf,
.pref-spellchecker .el-table th,
.pref-spellchecker .el-table td {
  border: none;
}
.pref-spellchecker .el-table th.el-table__cell.is-leaf:last-child,
.pref-spellchecker .el-table th:last-child,
.pref-spellchecker .el-table td:last-child {
  border-right: 1px solid var(--tableBorderColor);
}
.pref-spellchecker .el-table--border::after,
.pref-spellchecker .el-table--group::after,
.pref-spellchecker .el-table::before,
.pref-spellchecker .el-table__fixed-right::before,
.pref-spellchecker .el-table__fixed::before {
  background: var(--tableBorderColor);
}
.pref-spellchecker .el-table__body tr.hover-row.current-row > td,
.pref-spellchecker .el-table__body tr.hover-row.el-table__row--striped.current-row > td,
.pref-spellchecker .el-table__body tr.hover-row.el-table__row--striped > td,
.pref-spellchecker .el-table__body tr.hover-row > td {
  background: var(--selectionColor);
}
.pref-spellchecker .el-table .el-table__cell {
  padding: 2px 0;
  margin: 4px 6px;
}

.pref-spellchecker li.el-select-dropdown__item {
  color: var(--editorColor);
  height: 30px;
}
.pref-spellchecker li.el-select-dropdown__item.hover,
li.el-select-dropdown__item:hover {
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
