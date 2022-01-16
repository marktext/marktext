<template>
  <div class="pref-cb-legal-notices">
    <el-checkbox v-model="uploaderService.agreedToLegalNotices"></el-checkbox>
    <span>
      By using {{ uploaderService.name }}, you agree to {{ uploaderService.name }}'s
      <span class="link" @click="openUrl(uploaderService.privacyUrl)">Privacy Statement</span>
      and
      <span class="link" @click="openUrl(uploaderService.tosUrl)">Terms of Service</span>.
      <span v-if="!uploaderService.isGdprCompliant">This service cannot be used in Europe due to GDPR issues.</span>
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
