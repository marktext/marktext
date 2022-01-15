<template>
  <div class="pref-image-uploader">
    <h5>Uploader</h5>
    <section class="current-uploader">
      <div v-if="isValidUploaderService(currentUploader)">The current image uploader is
        {{ getServiceNameById(currentUploader) }}.</div>
      <span v-else>Currently no uploader is selected. Please select an uploader and click on "Set as
        default".</span>
    </section>
    <section class="configration">
      <el-tabs v-model="activeTab">
        <el-tab-pane label="SM.MS" name="smms">
          <div class="description">Thank you <span class="link"
              @click="open('https://sm.ms/')">SM.MS</span> for
            providing free uploading
            services.
          </div>
          <legal-notices-checkbox class="smms" :class="[{ 'error': legalNoticesErrorStates.smms }]"
            :uploaderService="uploadServices.smms"></legal-notices-checkbox>
          <el-button size="mini" @click="setCurrentUploader('smms')">Set as default</el-button>
        </el-tab-pane>
        <el-tab-pane label="GitHub" name="github">
          <div class="form-group">
            <div class="label">
              GitHub token:
              <el-tooltip class="item" effect="dark"
                content="The token is saved by Keychain on macOS, Secret Service API/libsecret on Linux and Credential Vault on Windows"
                placement="top-start">
                <i class="el-icon-info"></i>
              </el-tooltip>
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
          <div class="form-group">
            <div class="label">Branch name (optional):</div>
            <el-input v-model="github.branch" placeholder="branch" size="mini"></el-input>
          </div>
          <legal-notices-checkbox class="github"
            :class="[{ 'error': legalNoticesErrorStates.github }]"
            :uploaderService="uploadServices.github"></legal-notices-checkbox>
          <div class="form-group">
            <el-button size="mini" :disabled="githubDisable" @click="save('github')">Save
            </el-button>
            <el-button size="mini" :disabled="githubDisable" @click="setCurrentUploader('github')">
              Set as default</el-button>
          </div>
        </el-tab-pane>
        <el-tab-pane label="Command-line Script" name="cliScript">
          <div class="description">The script will be executed with the image file path as its only
            argument and it should output any valid value for the <code>src</code> attribute of a
            <em>HTMLImageElement</em>.
          </div>
          <div class="form-group">
            <div class="label">
              Shell script location
            </div>
            <el-input v-model="cliScript" placeholder="Script absolute path" size="mini"></el-input>
          </div>
          <div class="form-group">
            <el-button size="mini" :disabled="cliScriptDisable" @click="save('cliScript')">Save
            </el-button>
            <el-button size="mini" :disabled="cliScriptDisable"
              @click="setCurrentUploader('cliScript')">Set as default
            </el-button>
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
import { isFileExecutableSync } from '@/util/fileSystem'

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
      cliScript: '',
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
    prefCliScript: {
      get: function () {
        return this.$store.state.preferences.cliScript
      }
    },
    githubDisable () {
      return !this.githubToken || !this.github.owner || !this.github.repo
    },
    cliScriptDisable () {
      if (!this.cliScript) {
        return true
      }
      return !isFileExecutableSync(this.cliScript)
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
      this.cliScript = this.prefCliScript

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
      if (type === 'cliScript') {
        this.$store.dispatch('SET_USER_DATA', {
          type: 'cliScript',
          value: this.cliScript
        })
      }
      if (withNotice && type === 'github') {
        new Notification('Save Image Uploader', {
          body: 'The Github configration has been saved.'
        })
      }
      if (withNotice && type === 'cliScript') {
        new Notification('Save Image Uploader', {
          body: 'The command line script configuration has been saved'
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
      if (value === 'github' || value === 'cliScript') {
        this.save(value, false)
      }
      if (this.legalNoticesErrorStates[value] !== undefined) {
        this.legalNoticesErrorStates[value] = false
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
