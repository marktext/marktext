<template>
  <div class="pref-image">
    <h4 v-if="!embedded">
      {{ t('preferences.image.title') }}
    </h4>
    <compound>
      <template #head>
        <h6 class="title">
          {{ t('preferences.image.title') }}
        </h6>
      </template>
      <template #children>
        <CurSelect
          id="setting-imageInsertAction"
          :description="preferenceLabel('imageInsertAction')"
          :value="imageInsertAction"
          :options="imageActions"
          :on-change="selectInsertAction"
        />
        <Separator />
        <FolderSetting v-if="showFolderSettings" />
        <Uploader v-if="showUploader" />
      </template>
    </compound>
  </div>
</template>

<script setup lang="ts">
defineProps<{ embedded?: boolean }>()

import { computed } from 'vue'
import { preferenceDefinitions, preferenceLabel } from '../registry'
import { useRoute, useRouter } from 'vue-router'
import Compound from '../common/compound/index.vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { usePreferencesStore } from '@/store/preferences'
import Separator from '../common/separator/index.vue'
import Uploader from './components/uploader/index.vue'
import CurSelect from '../common/select/index.vue'
import FolderSetting from './components/folderSetting/index.vue'
import { getImageActions } from './config'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
// Search reveals inactive image settings without changing the insertion behavior.
const searchSection = computed(() => typeof route.query.setting === 'string'
  ? preferenceDefinitions[route.query.setting]?.section
  : undefined)

const preferenceStore = usePreferencesStore()

const { imageInsertAction } = storeToRefs(preferenceStore)

const imageActions = computed(() => getImageActions())
const showFolderSettings = computed(() => imageInsertAction.value === 'folder' || imageInsertAction.value === 'path' || searchSection.value === 'imageFolder')
const showUploader = computed(() => imageInsertAction.value === 'upload' || searchSection.value === 'imageUploader')

const selectInsertAction = async (value: unknown): Promise<void> => {
  preferenceStore.SET_SINGLE_PREFERENCE({ type: 'imageInsertAction', value })
  if (route.query.setting) {
    const query = { ...route.query }
    delete query.setting
    await router.replace({ query })
  }
}
</script>
