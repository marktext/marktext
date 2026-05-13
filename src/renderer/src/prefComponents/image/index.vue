<template>
  <div class="pref-image">
    <h4>{{ t('preferences.image.title') }}</h4>
    <section class="image-ctrl">
      <div>
        {{ t('preferences.image.defaultAction') }}
        <el-tooltip
          class="item"
          effect="dark"
          :content="t('preferences.image.clipboardTooltip')"
          placement="top-start"
        >
          <InfoFilled
            width="16"
            height="16"
          />
        </el-tooltip>
      </div>
      <CurSelect
        :value="imageInsertAction"
        :options="imageActions"
        :on-change="(value) => onSelectChange('imageInsertAction', value)"
      />
    </section>
    <Separator />
    <FolderSetting v-if="imageInsertAction === 'folder' || imageInsertAction === 'path'" />
    <Uploader v-if="imageInsertAction === 'upload'" />
  </div>
</template>

<script setup>
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { usePreferencesStore } from '@/store/preferences'
import Separator from '../common/separator/index.vue'
import Uploader from './components/uploader/index.vue'
import CurSelect from '../common/select/index.vue'
import FolderSetting from './components/folderSetting/index.vue'
import { getImageActions } from './config'
import { InfoFilled } from '@element-plus/icons-vue'

const { t } = useI18n()

const preferenceStore = usePreferencesStore()

const { imageInsertAction } = storeToRefs(preferenceStore)

const imageActions = getImageActions()

const onSelectChange = (type, value) => {
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
