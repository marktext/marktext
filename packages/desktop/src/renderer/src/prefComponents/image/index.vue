<template>
  <div class="pref-image">
    <h4 v-if="!embedded">
      {{ t('preferences.image.title') }}
    </h4>
    <CurSelect
      id="setting-imageInsertAction"
      :description="preferenceLabel('imageInsertAction')"
      :value="imageInsertAction"
      :options="imageActions"
      :on-change="value => onSelectChange('imageInsertAction', value)"
    />
    <Separator />
    <FolderSetting />
    <Uploader />
  </div>
</template>

<script setup lang="ts">
defineProps<{ embedded?: boolean }>()

import { computed } from 'vue'
import { preferenceLabel } from '../registry'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { usePreferencesStore } from '@/store/preferences'
import type { PreferencesState } from '@/store/preferences'
import Separator from '../common/separator/index.vue'
import Uploader from './components/uploader/index.vue'
import CurSelect from '../common/select/index.vue'
import FolderSetting from './components/folderSetting/index.vue'
import { getImageActions } from './config'

const { t } = useI18n()

const preferenceStore = usePreferencesStore()

const { imageInsertAction } = storeToRefs(preferenceStore)

const imageActions = computed(() => getImageActions())

const onSelectChange = (type: keyof PreferencesState, value: unknown): void => {
  preferenceStore.SET_SINGLE_PREFERENCE({ type, value })
}
</script>

<style>
.pref-image {
  & .image-ctrl {
    font-size: 14px;
    margin: 20px 0;
    color: var(--editorColor);
    & label {
      display: block;
      margin: 20px 0;
    }
  }
}
</style>
