<template>
  <div class="pref-image-uploader">
    <h5>Uploader</h5>
    <section class="current-uploader">
      <div v-if="isValidUploaderService(currentUploader)">The current image uploader is
        {{ getServiceNameById(currentUploader) }}.</div>
      <span v-else>Currently no uploader is selected. Please select an uploader and config
        it.</span>
    </section>
    <section class="configration">
      <cur-select :value="currentUploader" :options="uploaderOptions"
        :onChange="value => setCurrentUploader(value)"></cur-select>
      <div class="github" v-if="currentUploader === 'github'">
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
        </div>
      </div>
      <div class="script" v-else-if="currentUploader === 'cliScript'">
        <div class="description">The script will be executed with the image file path as its only
          argument and it should output any valid value for the <code>src</code> attribute of a
          <em>HTMLImageElement</em>.
        </div>
        <div class="form-group">
          <div class="label">Shell script location:</div>
          <el-input v-model="cliScript" placeholder="Script absolute path" size="mini"></el-input>
        </div>
        <div class="form-group">
          <el-button size="mini" :disabled="cliScriptDisable" @click="save('cliScript')">Save
          </el-button>
        </div>
      </div>
    </section>
  </div>
</template>

<script>
import { shell } from 'electron'
import services, { isValidService } from './services.js'
import legalNoticesCheckbox from './legalNoticesCheckbox'
import { isFileExecutableSync } from '@/util/fileSystem'
import CurSelect from '@/prefComponents/common/select'

export default {
  components: {
    legalNoticesCheckbox,
    CurSelect
  },
  data () {
    this.uploaderOptions = Object.keys(services).map(name => {
      const { name: label } = services[name]
      return {
        label,
        value: name
      }
    })
    return {
      githubToken: '',
      github: {
        owner: '',
        repo: '',
        branch: ''
      },
      cliScript: '',
      uploadServices: services,
      legalNoticesErrorStates: {
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
      this.validate(type)
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
      const type = 'currentUploader'
      this.$store.dispatch('SET_USER_DATA', { type, value })
    },
    validate (value) {
      const service = services[value]
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
  color: var(--editorColor);
  font-size: 14px;

  & .current-uploader {
    margin: 20px 0;
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
  & .el-input__inner {
    background: transparent;
  }
  & .el-button.btn-reset,
  & .button-group {
    margin-top: 30px;
  }
  & .pref-cb-legal-notices {
    &.github {
      margin-top: 30px;
    }
    &.error {
      border: 1px solid var(--deleteColor);
    }
  }
}
</style>
