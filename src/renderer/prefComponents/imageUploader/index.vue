<template>
  <div class="pref-image-uploader">
    <h4>Image Uploader</h4>
    <section class="configration">
      <el-tabs v-model="activeTab">
        <el-tab-pane label="Overview" name="none">
          <div v-if="currentUploader !== 'none'">
            <div>The current image uploader is {{ getServiceNameById(currentUploader) }}.</div>

            <!-- TODO: Reset all uploader settings and secret values. -->
            <el-button class="btn-reset" size="mini" disabled>Reset</el-button>
          </div>
          <span v-else>Currently is no uploader selected. Please select an uploader and click on "Set as default".</span>
        </el-tab-pane>
        <el-tab-pane label="SM.MS" name="smms">
          <div class="description">Thank you <span class="link" @click="open('https://sm.ms/')">SM.MS</span> for providing free uploading services.</div>
          <legal-notices-checkbox class="smms" :uploaderService="uploadServices.smms"></legal-notices-checkbox>
          <el-button size="mini" @click="setCurrentUploader('smms')">Set as default</el-button>
        </el-tab-pane>
        <el-tab-pane label="GitHub" name="github">
          <div class="form-group">
            <div class="label">
              GitHub token:
              <i class="el-icon-info" title="Tokens are saved by Keychain on macOS, Secret Service API/libsecret on Linux and Credential Vault on Windows."></i>
            </div>
            <el-input v-model="githubToken" placeholder="Input token" size="mini"></el-input>
          </div>
          <div class="form-group">
            <div class="label">Owner name:</div>
            <el-input v-model="github.owner" placeholder="owner" size="mini"></el-input>
          </div>
          <div class="form-group">
            <div class="label">Repo name:</div>
            <el-input v-model="github.repo" placeholder="repo" size="mini"></el-input>
          </div>
          <legal-notices-checkbox class="github" :uploaderService="uploadServices.github"></legal-notices-checkbox>
          <div class="form-group button-group">
            <el-button size="mini" :disabled="githubDisable" @click="save('github')">Save</el-button>
            <el-button size="mini" :disabled="githubDisable" @click="setCurrentUploader('github')">Set as default</el-button>
          </div>
        </el-tab-pane>
      </el-tabs>
    </section>
  </div>
</template>

<script>
import { shell } from 'electron'
import services from './services.js'
import legalNoticesCheckbox from './legalNoticesCheckbox'

export default {
  components: {
    legalNoticesCheckbox
  },
  data () {
    return {
      activeTab: 'none',
      githubToken: '',
      github: {
        owner: '',
        repo: ''
      },
      uploadServices: services
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
    getServiceNameById (id) {
      const service = services[id]
      return service ? service.name : id
    },
    open (link) {
      shell.openExternal(link)
    },
    save (type) {
      const newImageBedConfig = Object.assign({}, this.imageBed, {[type]: this[type]})
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
      new Notification('Save Image Uploader', {
        body: `The Github configration has been saved.`
      })
    },
    setCurrentUploader (value) {
      const service = services[value]
      if (!service) {
        console.error(`Cannot find service "${value}"!`)
        return
      }

      const legalNotices = document.getElementsByClassName(`pref-cb-legal-notices ${value}`)
      if (!legalNotices) {
        console.error(`Cannot find legal notices of service "${value}"!`)
        return
      }
      legalNotices[0].classList.remove('error')

      const { name, agreedToLegalNotices } = service
      if (!agreedToLegalNotices) {
        legalNotices[0].classList.add('error')
        return
      }

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
    font-weight: 100;
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
      border: 1px solid var(--themeColor);
      padding: 6px;
    }
  }
}
</style>
