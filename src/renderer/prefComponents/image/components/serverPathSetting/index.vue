<template>
  <section class="server-path-folder">
    <h5>Maintain server paths during editing and preview</h5>
    <text-box description="Server path (i.e.: /images/)" :input="serverFolderPath"
      :onChange="value => onSelectChange('serverFolderPath', value)"></text-box>
    <text-box description="Local path (relative or absolute)" :input="localFolderPath"
      :onChange="value => modifyLocalFolderPath(value)"></text-box>
    <div>
      <el-button size="mini" @click="modifyLocalFolderPath(undefined)">Browse...</el-button>
    </div>
  </section>
</template>

<script>
import { mapState } from 'vuex'
import TextBox from '@/prefComponents/common/textBox'

export default {
  components: {
    TextBox
  },
  data () {
    return {
    }
  },
  computed: {
    ...mapState({
      serverFolderPath: state => state.preferences.serverFolderPath,
      localFolderPath: state => state.preferences.localFolderPath
    })
  },
  methods: {
    modifyLocalFolderPath (value) {
      return this.$store.dispatch('SET_LOCAL_FOLDER_PATH', value)
    },
    onSelectChange (type, value) {
      this.$store.dispatch('SET_SINGLE_PREFERENCE', { type, value })
    }
  }
}
</script>

<style scoped>
.image-folder .footnote {
  font-size: 13px;
  & code {
    font-size: 13px;
  }
}
</style>
