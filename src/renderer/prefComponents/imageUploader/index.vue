<template>
  <div class="pref-image-uploader">
    <h4>{{ $t('preferences.imageUploader._title') }}</h4>
    <section class="current-uploader">
      <div v-if="isValidUploaderService(currentUploader)">{{ $t('preferences.imageUploader.currentUploaderIs') }} {{ getServiceNameById(currentUploader) }}</div>
      <span v-else>{{ $t('preferences.imageUploader.noUploaderSelected') }}</span>
    </section>
    <section class="configration">
      <el-tabs v-model="activeTab">
        <el-tab-pane label="SM.MS" name="smms">
            <!--
                Process i18n message with inline hyperlink.
                See: https://kazupon.github.io/vue-i18n/zh/guide/interpolation.html#%E5%9F%BA%E6%9C%AC%E7%94%A8%E6%B3%95

                NOTICE: Do not use <i18n-t>. Use <i18n>.
             -->
          <div class="description">
            <i18n path="preferences.imageUploader.SMMS.ThankSMMS" tag="label" for="preferences.imageUploader.SMMS">
              <span class="link" @click="open('https://sm.ms/')">{{ $t('preferences.imageUploader.SMMS.linkLabel') }}</span>
            </i18n>
          </div>
          <legal-notices-checkbox
            class="smms"
            :class="[{ 'error': legalNoticesErrorStates.smms }]"
            :uploaderService="uploadServices.smms"
          ></legal-notices-checkbox>
          <el-button size="mini" @click="setCurrentUploader('smms')">{{ $t('preferences.imageUploader.setAsDefault') }}</el-button>
        </el-tab-pane>
        <el-tab-pane label="GitHub" name="github">
          <div class="form-group">
            <div class="label">
              {{ $t('preferences.imageUploader.GitHub.token') }}
              <el-tooltip
                class="item"
                effect="dark"
                :content="$t('preferences.imageUploader.GitHub.tokenNotice')"
                placement="top-start"
              >
                <i class="el-icon-info"></i>
              </el-tooltip>
            </div>
            <el-input v-model="githubToken" :placeholder="$t('preferences.imageUploader.GitHub.tokenPlaceholder')" size="mini"></el-input>
          </div>
          <div class="form-group">
            <div class="label">{{ $t('preferences.imageUploader.GitHub.owner') }}</div>
            <el-input v-model="github.owner" :placeholder="$t('preferences.imageUploader.GitHub.tokenPlaceholder')" size="mini"></el-input>
          </div>
          <div class="form-group">
            <div class="label">{{ $t('preferences.imageUploader.GitHub.repo') }}</div>
            <el-input v-model="github.repo" :placeholder="$t('preferences.imageUploader.GitHub.ownerPlaceholder')" size="mini"></el-input>
          </div>
          <div class="form-group">
            <div class="label">{{ $t('preferences.imageUploader.GitHub.branch') }}</div>
            <el-input v-model="github.branch" :placeholder="$t('preferences.imageUploader.GitHub.branchPlaceholder')" size="mini"></el-input>
          </div>
          <legal-notices-checkbox
            class="github"
            :class="[{ 'error': legalNoticesErrorStates.github }]"
            :uploaderService="uploadServices.github"
          ></legal-notices-checkbox>
          <div class="form-group">
            <el-button size="mini" :disabled="githubDisable" @click="save('github')">{{ $t('preferences.imageUploader.save') }}</el-button>
            <el-button size="mini" :disabled="githubDisable" @click="setCurrentUploader('github')">{{ $t('preferences.imageUploader.setAsDefault') }}</el-button>
          </div>
        </el-tab-pane>
      </el-tabs>
    </section>
  </div>
</template>

<script>
import { shell } from 'electron'
import services, { isValidService } from './services.js'
import legalNoticesCheckbox from './legalNoticesCheckbox'

export default {
  components: {
    legalNoticesCheckbox
  },
  data () {
    return {
      activeTab: 'smms',
      githubToken: '',
      github: {
        owner: '',
        repo: '',
        branch: ''
      },
      uploadServices: services,
      legalNoticesErrorStates: {
        smms: false,
        github: false
      }
    }
  },
  computed: {
    currentUploader: {
      get: function () {
        return this.$store.state.preferences.currentUploader
      }
    },
    imageBed: {
      get: function () {
        return this.$store.state.preferences.imageBed
      }
    },
    prefGithubToken: {
      get: function () {
        return this.$store.state.preferences.githubToken
      }
    },
    githubDisable () {
      return !this.githubToken || !this.github.owner || !this.github.repo
    }
  },
  watch: {
    imageBed: function (value, oldValue) {
      if (value !== oldValue) {
        this.github = value.github
      }
    }
  },
  created () {
    this.$nextTick(() => {
      this.github = this.imageBed.github
      this.githubToken = this.prefGithubToken

      if (services.hasOwnProperty(this.currentUploader)) {
        services[this.currentUploader].agreedToLegalNotices = true
      }
    })
  },
  methods: {
    isValidUploaderService (name) {
      return isValidService(name)
    },
    getServiceNameById (id) {
      const service = services[id]
      return service ? service.name : id
    },
    open (link) {
      shell.openExternal(link)
    },
    save (type, withNotice = true) {
      const newImageBedConfig = Object.assign({}, this.imageBed, { [type]: this[type] })
      this.$store.dispatch('SET_USER_DATA', {
        type: 'imageBed',
        value: newImageBedConfig
      })
      if (type === 'github') {
        this.$store.dispatch('SET_USER_DATA', {
          type: 'githubToken',
          value: this.githubToken
        })
      }
      if (withNotice) {
        new Notification('Save Image Uploader', {
          body: 'The Github configration has been saved.'
        })
      }
    },
    setCurrentUploader (value) {
      const service = services[value]
      if (!service) {
        console.error(`Cannot find service "${value}"!`)
        return
      }

      const { name, agreedToLegalNotices } = service
      if (!agreedToLegalNotices) {
        this.legalNoticesErrorStates[value] = true
        return
      }
      // Save the setting before set it as default uploader.
      if (value === 'github') {
        this.save(value, false)
      }
      this.legalNoticesErrorStates[value] = false

      const type = 'currentUploader'
      this.$store.dispatch('SET_USER_DATA', { type, value })

      new Notification('Set Image Uploader', {
        body: `Set ${name} as the default image uploader successfully.`
      })
    }
  }
}
</script>

<style>
.pref-image-uploader {
  & h4 {
    text-transform: uppercase;
    margin: 0;
    font-weight: 400;
  }
  & .current-uploader {
    font-size: 14px;
    margin: 20px 0;
    color: var(--editorColor);
    & .uploader {
      color: var(--editorColor80);
      font-size: 600;
    }
  }
  & .link {
    color: var(--themeColor);
    cursor: pointer;
  }
  & .description {
    margin-top: 20px;
    margin-bottom: 20px;
  }
  & .form-group {
    margin: 20px 0 0 0;
  }
  & .label {
    margin-bottom: 10px;
  }
  & .el-input {
    max-width: 242px;
  }
  & .el-button.btn-reset,
  & .button-group {
    margin-top: 30px;
  }
  & .pref-cb-legal-notices {
    &.smms {
      margin-bottom: 30px;
    }
    &.github {
      margin-top: 30px;
    }
    &.error {
      border: 1px solid var(--deleteColor);
    }
  }
}
</style>
