<template>
  <div class="pref-theme">
    <h4>Theme</h4>
    <section class="offcial-themes">
      <div v-for="t of themes" :key="t.name" class="theme"
        :class="[t.name, { 'active': t.name === theme }]"
        :style="previewStyle(t.name)"
        @click="onSelectChange('theme', t.name)"
      >
        <div v-html="t.html"></div>
      </div>
    </section>

    <section v-if="hasAccentPicker" class="neon-accent-picker">
      <h5>Background Accent</h5>
      <div class="neon-swatches">
        <div
          v-for="swatch of accentSwatches"
          :key="swatch.value"
          class="neon-swatch"
          :class="{ active: swatch.value === accentColor }"
          :style="{ background: swatch.value }"
          :title="swatch.label"
          @click="setAccent(swatch.value)"
        ></div>
      </div>
    </section>

    <separator></separator>
    <cur-select
      description="Automatically adjust application theme according to system settings"
      :value="autoSwitchTheme"
      :options="autoSwitchThemeOptions"
      :onChange="value => onSelectChange('autoSwitchTheme', value)"
    ></cur-select>
    <separator v-show="false"></separator>
    <section v-show="false" class="import-themes ag-underdevelop">
      <div>
        <span>Open the themes folder</span>
        <el-button size="small">Open Folder</el-button>
      </div>
      <div>
        <span>Import custom themes</span>
        <el-button size="small">Import Theme</el-button>
      </div>
    </section>
  </div>
</template>

<script>
import { mapState } from 'vuex'
import themeMd from './theme.md'
import { autoSwitchThemeOptions, themes } from './config'
import markdownToHtml from '@/util/markdownToHtml'
import CurSelect from '../common/select'
import Separator from '../common/separator'
// Note: we do NOT call applyAccentColor here. The preferences window
// only saves to localStorage and updates preview cards. The editor window
// picks up changes via the storage event listener in theme.js.

// Each theme that supports accent picking has its own swatch palette and storage key.
const ACCENT_CONFIG = {
  'neon-editorial': {
    storageKey: 'neon-editorial-bg',
    defaultColor: '#F7F6F2',
    swatches: [
      { label: 'Paper', value: '#F7F6F2' },
      { label: 'Electric Cyan', value: '#00E5FF' },
      { label: 'Hot Magenta', value: '#FF2D9B' },
      { label: 'Toxic Lime', value: '#B7FF00' },
      { label: 'UV Violet', value: '#7B61FF' },
      { label: 'Signal Orange', value: '#FF6A00' },
      { label: 'Laser Lemon', value: '#EEFF00' },
      { label: 'Plasma Pink', value: '#FF6EC7' },
      { label: 'Acid Green', value: '#00FF66' },
      { label: 'Pure White', value: '#FFFFFF' }
    ]
  },
  'neon-editorial-dark': {
    storageKey: 'neon-editorial-dark-bg',
    defaultColor: '#0A0D10',
    swatches: [
      { label: 'Ink Black', value: '#0A0D10' },
      { label: 'Neon Navy', value: '#0B1A3B' },
      { label: 'Oxide Red', value: '#2A0A0A' },
      { label: 'Deep Emerald', value: '#021A12' },
      { label: 'Plum', value: '#1A0520' },
      { label: 'Burnt Amber', value: '#1F1005' },
      { label: 'Teal Abyss', value: '#041A1A' },
      { label: 'Graphite', value: '#1A1A1A' },
      { label: 'Indigo', value: '#100830' },
      { label: 'True Black', value: '#000000' }
    ]
  },
  ashley: {
    storageKey: 'ashley-bg',
    defaultColor: '#F7F6F2',
    swatches: [
      { label: 'Paper', value: '#F7F6F2' },
      { label: 'Cyan Wash', value: '#E6FAFE' },
      { label: 'Magenta Wash', value: '#FFF0F8' },
      { label: 'Lime Wash', value: '#F4FFE0' },
      { label: 'Violet Wash', value: '#F0EEFF' },
      { label: 'Orange Wash', value: '#FFF3E8' },
      { label: 'Pure White', value: '#FFFFFF' },
      { label: 'Cool Grey', value: '#F0F2F5' }
    ]
  },
  'ashley-dark': {
    storageKey: 'ashley-dark-bg',
    defaultColor: '#0C1F0C',
    swatches: [
      { label: 'Bottle Green', value: '#0C1F0C' },
      { label: 'Brunswick Green', value: '#0A2A1A' },
      { label: 'Racing Green', value: '#0D3020' },
      { label: 'Hunter Green', value: '#1A2E1A' },
      { label: 'Forest Floor', value: '#142014' },
      { label: 'Viridian Deep', value: '#0A2520' },
      { label: 'Olive Black', value: '#181C10' },
      { label: 'Ivy', value: '#102818' }
    ]
  }
}

export default {
  components: {
    CurSelect,
    Separator
  },
  data () {
    this.autoSwitchThemeOptions = autoSwitchThemeOptions
    return {
      themes: [],
      accentColor: '#F7F6F2',
      accentVersion: 0
    }
  },
  computed: {
    ...mapState({
      autoSwitchTheme: state => state.preferences.autoSwitchTheme,
      theme: state => state.preferences.theme
    }),
    hasAccentPicker () {
      return !!ACCENT_CONFIG[this.theme]
    },
    accentSwatches () {
      const cfg = ACCENT_CONFIG[this.theme]
      return cfg ? cfg.swatches : []
    }
  },
  watch: {
    theme (value) {
      this.loadAccent(value)
    }
  },
  created () {
    this.$nextTick(async () => {
      const newThemes = []
      for (const theme of themes) {
        const html = await markdownToHtml(themeMd.replace(/{theme}/, theme.name))
        newThemes.push({ name: theme.name, html })
      }
      this.themes = newThemes
      this.loadAccent(this.theme)
    })
  },
  methods: {
    onSelectChange (type, value) {
      this.$store.dispatch('SET_SINGLE_PREFERENCE', { type, value })
    },

    loadAccent (theme) {
      const cfg = ACCENT_CONFIG[theme]
      if (cfg) {
        this.accentColor = localStorage.getItem(cfg.storageKey) || cfg.defaultColor
      }
    },

    setAccent (color) {
      this.accentColor = color
      this.accentVersion++
      const cfg = ACCENT_CONFIG[this.theme]
      if (cfg) {
        localStorage.setItem(cfg.storageKey, color)
      }
      // Editor windows pick up the change via storage event listener in theme.js
    },

    // Show saved accent on any theme card that supports it.
    // Depends on accentVersion to force re-render after swatch clicks.
    previewStyle (themeName) {
      const _ = this.accentVersion // eslint-disable-line no-unused-vars
      const cfg = ACCENT_CONFIG[themeName]
      if (!cfg) return {}
      const saved = localStorage.getItem(cfg.storageKey) || cfg.defaultColor
      return { background: saved }
    }
  }
}
</script>

<style>
  .offcial-themes {
    margin-top: 12px;
    & .theme {
      cursor: pointer;
      width: 248px;
      height: 100px;
      margin: 0px 20px 10px 20px;
      padding-left: 30px;
      padding-top: 20px;
      overflow: hidden;
      display: inline-block;
      background: var(--editorBgColor);
      color: var(--editorColor);
      box-sizing: border-box;
      box-shadow: 0 9px 28px -9px rgba(0, 0, 0, .4);
      border-radius: 5px;
      &.dark {
        color: rgba(255, 255, 255, .7);
        background: #282828;
        & a { color: #409eff; }
      }
      &.light {
        color: rgba(0, 0, 0, .7);
        background: rgba(255, 255, 255, 1);
        & a { color: rgba(33, 181, 111, 1); }
      }
      &.graphite {
        color: rgba(43, 48, 50, .7);
        background: #f7f7f7;
        & a { color: rgb(104, 134, 170); }
      }
      &.material-dark {
        color: rgba(171, 178, 191, .8);
        background: #34393f;
        & a { color: #f48237; }
      }
      &.one-dark {
        color: #9da5b4;
        background: #282c34;
        & a { color: rgba(226, 192, 141, 1); }
      }
      &.ulysses {
        color: rgba(101, 101, 101, .7);
        background: #f3f3f3;
        & a { color: rgb(12, 139, 186); }
      }
      &.neon-editorial {
        color: #17181C;
        /* background set via previewStyle() to show saved accent */
        & a { color: #00C2FF; }
      }
      &.neon-editorial-dark {
        color: #F3F7FB;
        /* background set via previewStyle() */
        & a { color: #2DE2FF; }
      }
      &.ashley {
        color: #3A3540;
        /* background set via previewStyle() */
        & a { color: #7EB8C9; }
      }
      &.ashley-dark {
        color: #E8E0D0;
        /* background set via previewStyle() */
        & a { color: #8FBC8F; }
      }
    }
    & .theme.active {
      box-shadow: var(--floatShadow);
    }
    & h3 {
      margin: 0;
      font-size: 16px;
      color: currentColor;
      cursor: pointer;
      &::before {
        content: 'h3';
        position: absolute;
        top: 4px;
        left: -20px;
        display: block;
        width: 10px;
        height: 10px;
        font-size: 12px;
        opacity: .5;
      }
    }
    & p {
      font-size: 12px;
    }
  }

  .neon-accent-picker {
    padding: 8px 20px 4px;
    & h5 {
      margin: 0 0 10px;
      font-size: 13px;
      font-weight: 600;
      color: var(--editorColor);
      opacity: .7;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
  }

  .neon-swatches {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .neon-swatch {
    width: 36px;
    height: 36px;
    border-radius: 6px;
    cursor: pointer;
    border: 2px solid transparent;
    box-shadow: 0 1px 4px rgba(0, 0, 0, .15);
    transition: border-color .15s ease, transform .1s ease, box-shadow .15s ease;
  }
  .neon-swatch:hover {
    transform: scale(1.1);
    box-shadow: 0 2px 8px rgba(0, 0, 0, .25);
  }
  .neon-swatch.active {
    border-color: var(--themeColor);
    box-shadow: 0 0 0 2px var(--themeColor40);
  }

  .import-themes {
    padding: 10px 0;
    display: flex;
    justify-content: space-around;
    color: var(--editorColor);
    & > div {
      display: flex;
      flex-direction: column;
      & > span {
        display: inline-block;
        margin-bottom: 20px;
      }
    }
  }
</style>
