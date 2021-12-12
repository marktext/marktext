<template>
  <div class="pref-cb-legal-notices">
    <el-checkbox v-model="uploaderService.agreedToLegalNotices"></el-checkbox>
    <span>
      <i18n path="preferences.imageUploader.legalNotices.notice" tag="label" for="preferences.imageUploader.legalNotices">
        <span>{{ uploaderService.name }}</span>
        <span class="link" @click="openUrl(uploaderService.privacyUrl)">{{ $t('preferences.imageUploader.legalNotices.privacyStatement') }}</span>
        <span class="link" @click="openUrl(uploaderService.tosUrl)">{{ $t('preferences.imageUploader.legalNotices.termsOfService') }}</span>
      </i18n>
      <span v-if="!uploaderService.isGdprCompliant">{{ $t('preferences.imageUploader.legalNotices.GDPR') }}</span>
    </span>
  </div>
</template>

<script>
import { shell } from 'electron'

export default {
  data () {
    return {}
  },
  props: {
    uploaderService: Object
  },
  methods: {
    openUrl (link) {
      if (link) {
        shell.openExternal(link)
      }
    }
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
