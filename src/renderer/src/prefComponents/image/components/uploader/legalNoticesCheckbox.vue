<template>
  <div class="pref-cb-legal-notices">
    <!-- eslint-disable-next-line vue/no-mutating-props -->
    <el-checkbox v-model="uploaderService.agreedToLegalNotices" />
    <span>
      {{ t('preferences.image.uploader.legalNotices.byUsing', { name: uploaderService.name }) }}
      <span
        class="link"
        @click="openUrl(uploaderService.privacyUrl)"
      >{{
        t('preferences.image.uploader.legalNotices.privacyStatement')
      }}<LinkIcon
        :size="14"
        class="link-icon"
      /></span>
      {{ t('preferences.image.uploader.legalNotices.and') }}
      <span
        class="link"
        @click="openUrl(uploaderService.tosUrl)"
      >{{
        t('preferences.image.uploader.legalNotices.termsOfService')
      }}<LinkIcon
        :size="14"
        class="link-icon"
      /></span>.
      <span v-if="!uploaderService.isGdprCompliant">{{
        t('preferences.image.uploader.legalNotices.gdprWarning')
      }}</span>
    </span>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import LinkIcon from '@/components/icons/LinkIcon.vue'
import type { UploaderService } from './services'

const { t } = useI18n()

defineProps<{
  uploaderService: UploaderService
}>()

const openUrl = (link: string): void => {
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
  & .link .link-icon {
    margin-left: 2px;
    vertical-align: -2px;
    opacity: 0.7;
    color: var(--iconColor);
  }
  & .link .link-icon:hover {
    color: var(--themeColor);
  }
}
</style>
