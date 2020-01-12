<template>
  <div class="mark-map" ref="markMap">
      <svg class="mind-map" ref="mindMap" id="mindmap">
        <g class="markmap-node">
        </g>
      </svg>
  </div>
</template>

<script>
import { mapState } from 'vuex'
import bus from '../../bus'
import * as d3 from 'markmap/node_modules/d3'
import 'markmap/lib/d3-flextree'
const viewMindmap = require('markmap/lib/view.mindmap')
const parseMarkdwon = require('markmap/lib/parse.markdown')
const transformHeadings = require('markmap/lib/transform.headings')

export default {
  props: {
    markdown: String
  },
  computed: {
    ...mapState({
      theme: state => state.preferences.theme,
      markMap: state => state.preferences.markMap,
      currentFile: state => state.editor.currentFile
    })
  },
  data () {
    return {
      contentState: null,
      editor: null,
      commitTimer: null,
      viewDestroyed: false,
      tabId: null
    }
  },
  created () {
    this.$nextTick(() => {
      const { pathname } = this.currentFile
      bus.$on('file-loaded', this.handleFileChange)
      bus.$on('file-changed', this.handleFileChange)
      this.tabId = pathname
      this.showMarkmap(this.markdown)
    })
  },
  beforeDestroy () {
    this.viewDestroyed = true
    if (this.commitTimer) clearTimeout(this.commitTimer)

    bus.$off('file-loaded', this.handleFileChange)
    bus.$off('file-changed', this.handleFileChange)
    // bus.$emit('file-changed', { id: this.tabId })
  },
  methods: {
    showMarkmap (markdown) {
      d3.select('svg#mindmap').selectAll('*').remove()
      var parseOpts = {
        lists: false
      }
      var viewOpts = {
        autoFit: true,
        preset: 'colorful', // or default
        linkShape: 'diagonal' // or bracket
      }
      d3.json('static/preference.json', function (error, text) {
        if (error) {
          throw error
        }

        if (markdown !== '') {
          const data = transformHeadings(parseMarkdwon(markdown, parseOpts))
          viewMindmap('svg#mindmap', data, viewOpts)
        }
      })
    },

    // Another tab was selected - only listen to get changes but don't set history or other things.
    handleFileChange ({ id, markdown }) {
      this.prepareTabSwitch()
      this.showMarkmap(markdown)
      this.tabId = id
    },

    // Commit changes from old tab. Problem: tab was already switched, so commit changes with old tab id.
    prepareTabSwitch () {
      if (this.commitTimer) clearTimeout(this.commitTimer)
      if (this.tabId) {
        // this.$store.dispatch('LISTEN_FOR_CONTENT_CHANGE', { id: this.tabId, pathname })
        this.tabId = null // invalidate tab id
      }
    }
  }
}
</script>

<style scoped>
    .mark-map .mind-map {
        margin: 25px;
        width: 90%;
        height: 90%;
    }
</style>

<style>
    .mark-map {
        height: calc(100vh - var(--titleBarHeight));
        box-sizing: border-box;
        overflow: auto;
    }
</style>
