<template>
  <div class="pref-sidebar">
    <h3 class="title">
      {{ t('preferences.title') }}
    </h3>
    <section class="search-wrapper">
      <el-autocomplete
        v-model="state"
        value-key="preference"
        :debounce="0"
        popper-class="pref-autocomplete"
        :fetch-suggestions="querySearch"
        :placeholder="t('preferences.search.placeholder')"
        :trigger-on-focus="false"
        :aria-label="t('preferences.search.placeholder')"
        @select="handleSelect"
      >
        <template #suffix>
          <Search
            width="16"
            height="16"
          />
        </template>
        <template #default="{ item }">
          <div class="name">
            {{ item.category }}
          </div>
          <span class="addr">{{ item.preference }}</span>
        </template>
      </el-autocomplete>
    </section>
    <section class="category">
      <button
        v-for="c of getCategory()"
        :key="c.name"
        type="button"
        class="item"
        :class="{ active: c.label === currentCategory }"
        :aria-current="c.label === currentCategory ? 'page' : undefined"
        @click="handleCategoryItemClick(c)"
      >
        <component :is="c.icon" />
        <span>{{ c.name }}</span>
      </button>
    </section>
  </div>
</template>
<script setup lang="ts">
import { getCategory, getTranslatedSearchContent, matchesSearch, type SearchEntry } from './config'
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { Search } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'
import { openSetting } from '../settingLocation'

const { t } = useI18n()
const router = useRouter()
const route = useRoute()
const currentCategory = computed(() => String(route.name || 'general'))
const state = ref('')
const entries = computed(() => getTranslatedSearchContent())

const querySearch = (query: string, callback: (results: SearchEntry[]) => void): void => {
  callback(entries.value.filter(entry => matchesSearch(entry, query)))
}
const handleSelect = (item: SearchEntry | undefined): void => {
  if (item) void openSetting(router, item.routeCategory, item.key)
}
const handleCategoryItemClick = (item: { path: string }): void => {
  void router.push({ path: item.path })
}
const onIpcCategoryChange = (_event: unknown, category: unknown): void => {
  if (typeof category !== 'string') return
  const target = getCategory().find(item => item.label === category)
  if (target) void router.push({ path: target.path })
}
onMounted(() => {
  window.electron.ipcRenderer.on('settings::change-tab', onIpcCategoryChange)
})
onUnmounted(() => {
  window.electron.ipcRenderer.removeAllListeners('settings::change-tab')
})
</script>

<style>
.pref-sidebar {
  -webkit-app-region: drag;
  display: flex;
  flex-direction: column;
  background: var(--sideBarBgColor);
  width: var(--prefSideBarWidth);
  height: 100vh;
  padding-top: 24px;
  box-sizing: border-box;
  & h3 {
    margin: 0;
    font-size: 20px;
    font-weight: normal;
    text-align: center;
    color: var(--sideBarColor);
  }
}
.search-wrapper {
  -webkit-app-region: no-drag;
  padding: 0 16px;
  margin: 18px 0;
}
.pref-sidebar .el-autocomplete {
  width: 100%;

  & .el-input__wrapper {
    background: transparent;
  }

  & .el-input__inner {
    border: none;
    background: transparent;
    height: 28px;
    line-height: 28px;
    font-size: 13px;
  }
}
.pref-autocomplete {
  background: var(--floatBgColor);
  border-color: var(--floatBorderColor);
  & .el-autocomplete-suggestion__wrap li:hover {
    background: var(--floatHoverColor);
  }
  & .popper__arrow {
    display: none;
  }
  & li {
    line-height: normal;
    padding: 7px;
    opacity: 0.8;

    & .name {
      text-overflow: ellipsis;
      overflow: hidden;
      font-weight: 600;
      color: var(--editorColor80);
    }
    & .addr {
      font-size: 12px;
      color: var(--editorColor);
    }

    & .highlighted .addr {
      color: var(--editorColor);
    }
  }
}
.category {
  -webkit-app-region: no-drag;
  overflow-y: auto;
  & .item {
    border: 0;
    background: transparent;
    text-align: left;
    font-family: inherit;
    width: 100%;
    height: 38px;
    font-size: 16px;
    color: var(--sideBarColor);
    padding-left: 16px;
    box-sizing: border-box;
    display: flex;
    flex-direction: row;
    align-items: center;
    cursor: pointer;
    position: relative;
    user-select: none;
    & > svg {
      width: 18px;
      height: 18px;
      color: var(--sideBarColor);
      margin-right: 12px;
    }
    &.active > svg {
      color: var(--sideBarTitleColor);
    }
    &:hover {
      background: var(--sideBarItemHoverBgColor);
    }
    &::before {
      content: '';
      width: 4px;
      height: 0;
      background: var(--highlightThemeColor);
      position: absolute;
      left: 0;
      border-top-right-radius: 3px;
      border-bottom-right-radius: 3px;
      transition: height 0.25s ease-in-out;
      top: 50%;
      transform: translateY(-50%);
    }
    &.active {
      color: var(--sideBarTitleColor);
    }
    &.active::before {
      height: 100%;
    }
  }
}
</style>
