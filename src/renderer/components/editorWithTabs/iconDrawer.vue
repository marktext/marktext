<template>
  <aside
    class="icon-drawer"
    :class="{ visible }"
  >
    <div class="drawer-header">
      <span>Icon Drawer</span>
      <button
        class="close-button"
        type="button"
        title="Close icon drawer"
        @click="$emit('close')"
      >
        ×
      </button>
    </div>
    <div class="drawer-actions">
      <button type="button" @click="$emit('add-custom')">
        Add Custom
      </button>
      <button type="button" @click="$emit('import-local')">
        Import Local
      </button>
      <button type="button" @click="$emit('refresh')">
        Refresh
      </button>
    </div>
    <div class="drawer-filter">
      <input
        v-model.trim="query"
        type="text"
        placeholder="Filter icons (example: :warning:)"
      >
    </div>

    <div class="drawer-body">
      <p v-if="loading" class="empty-state">Loading icons...</p>
      <p v-else-if="!filteredIcons.length" class="empty-state">
        No icons match this filter.
      </p>
      <ul v-else>
        <li v-for="icon of filteredIcons" :key="icon.id">
          <button
            class="icon-preview"
            type="button"
            :title="`Insert ${icon.name}`"
            @click="$emit('insert', icon)"
          >
            <span
              v-if="icon.iconType === 'emoji_text'"
              class="emoji-preview"
            >
              {{ icon.value }}
            </span>
            <img
              v-else
              :src="toIconSrc(icon.value)"
              :alt="icon.name"
            >
          </button>
          <div class="icon-meta">
            <span class="icon-name">{{ icon.name }}</span>
            <span class="icon-source">{{ icon.source }}</span>
          </div>
          <button
            v-if="icon.source !== 'default'"
            class="remove-button"
            type="button"
            title="Remove icon"
            @click="$emit('remove', icon.id)"
          >
            Remove
          </button>
        </li>
      </ul>
    </div>
  </aside>
</template>

<script>
export default {
  props: {
    visible: {
      type: Boolean,
      default: false
    },
    loading: {
      type: Boolean,
      default: false
    },
    icons: {
      type: Array,
      default: () => []
    }
  },
  data () {
    return {
      query: ''
    }
  },
  computed: {
    filteredIcons () {
      if (!this.query) return this.icons
      const query = this.query.toLowerCase()
      return this.icons.filter(icon => {
        const name = (icon.name || '').toLowerCase()
        const shortcode = (icon.shortcode || '').toLowerCase()
        const source = (icon.source || '').toLowerCase()
        return name.includes(query) || shortcode.includes(query) || source.includes(query)
      })
    }
  },
  methods: {
    toIconSrc (value) {
      if (!value) return ''
      if (/^(data:|https?:|file:)/.test(value)) return value
      if (/^[\\/]/.test(value) || /^[a-zA-Z]:\\/.test(value)) {
        const normalized = value.replace(/\\/g, '/')
        return `file://${normalized}`
      }
      return value
    }
  }
}
</script>

<style scoped>
  .icon-drawer {
    width: 0;
    min-width: 0;
    border-left: 1px solid transparent;
    background: var(--floatBgColor);
    color: var(--editorColor);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    transition: width .16s ease;
  }

  .icon-drawer.visible {
    width: 290px;
    min-width: 290px;
    border-left-color: var(--editorColor10);
  }

  .drawer-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 12px;
    font-weight: 600;
    padding: 10px 12px;
    border-bottom: 1px solid var(--editorColor10);
  }

  .close-button {
    border: none;
    background: transparent;
    color: var(--editorColor60);
    font-size: 16px;
    cursor: pointer;
    line-height: 1;
    padding: 0 2px;
  }

  .drawer-actions {
    display: flex;
    gap: 6px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--editorColor10);
  }

  .drawer-filter {
    padding: 8px 12px;
    border-bottom: 1px solid var(--editorColor10);
  }

  .drawer-filter > input {
    width: 100%;
    box-sizing: border-box;
    border: 1px solid var(--editorColor10);
    border-radius: 4px;
    background: var(--editorBgColor);
    color: var(--editorColor80);
    font-size: 12px;
    padding: 6px 8px;
  }

  .drawer-actions > button,
  .remove-button {
    border: 1px solid var(--editorColor10);
    border-radius: 4px;
    background: transparent;
    color: var(--editorColor80);
    font-size: 11px;
    padding: 4px 7px;
    cursor: pointer;
    white-space: nowrap;
  }

  .drawer-actions > button:hover,
  .remove-button:hover {
    color: var(--editorColor);
    border-color: var(--editorColor30);
    background: var(--editorColor04);
  }

  .drawer-body {
    flex: 1;
    overflow: auto;
    padding: 10px;
  }

  .empty-state {
    color: var(--editorColor50);
    font-size: 12px;
    margin: 0;
  }

  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  li {
    display: grid;
    grid-template-columns: 38px 1fr auto;
    align-items: center;
    gap: 8px;
    padding: 6px;
    border: 1px solid var(--editorColor10);
    border-radius: 6px;
  }

  .icon-preview {
    border: 1px solid var(--editorColor10);
    border-radius: 4px;
    background: var(--editorBgColor);
    width: 38px;
    height: 38px;
    padding: 4px;
    cursor: pointer;
  }

  .icon-preview > img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .emoji-preview {
    width: 100%;
    height: 100%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    line-height: 1;
  }

  .icon-meta {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .icon-name {
    font-size: 12px;
    color: var(--editorColor80);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .icon-source {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: .4px;
    color: var(--editorColor40);
  }
</style>
