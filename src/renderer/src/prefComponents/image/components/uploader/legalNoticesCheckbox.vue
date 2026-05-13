<template>
  <div class="pref-cb-legal-notices">
    <!-- eslint-disable-next-line vue/no-mutating-props -->
    <el-checkbox v-model="uploaderService.agreedToLegalNotices" />
    <span>
      {{ t('preferences.image.uploader.legalNotices.byUsing', { name: uploaderService.name }) }}
      <span
        class="link"
        @click="openUrl(uploaderService.privacyUrl)"
      >{{ t('preferences.image.uploader.legalNotices.privacyStatement') }}</span>
      {{ t('preferences.image.uploader.legalNotices.and') }}
      <span
        class="link"
        @click="openUrl(uploaderService.tosUrl)"
      >{{ t('preferences.image.uploader.legalNotices.termsOfService') }}</span>.
      <span v-if="!uploaderService.isGdprCompliant">{{ t('preferences.image.uploader.legalNotices.gdprWarning') }}</span>
    </span>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

defineProps({
  uploaderService: Object
})

const openUrl = (link) => {
  if (link) {
    window.electron.shell.openExternal(link)
  }
}
</script>

<style>
.pref-cb-legal-notices {
  border: 1px solid transparent;
  padding: 3px 5px;
  & .el-checkbox {
    margin-right: 0;
  }
}
</style>
