<template>
  <div
    class="pref-category"
    :class="`pref-${category}`"
  >
    <h4>{{ t(`preferences.categories.${category}`) }}</h4>
    <theme-settings
      v-if="category === 'appearance'"
      embedded
    />
    <general-settings
      v-if="generalGroups[category]"
      :key="`general-${category}`"
      :groups="generalGroups[category]"
      embedded
    />
    <editor-settings
      v-if="editorGroups[category]"
      :key="`editor-${category}`"
      :groups="editorGroups[category]"
      embedded
    >
      <template #before-misc>
        <spellchecker-settings
          v-if="category === 'editor'"
          embedded
        />
      </template>
    </editor-settings>
    <image-settings
      v-if="category === 'images'"
      embedded
    />
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { generalGroups, editorGroups, type PreferenceCategoryId } from './categories'
import GeneralSettings from './general/index.vue'
import EditorSettings from './editor/index.vue'
import ThemeSettings from './theme/index.vue'
import SpellcheckerSettings from './spellchecker/index.vue'
import ImageSettings from './image/index.vue'

defineProps<{ category: PreferenceCategoryId }>()
const { t } = useI18n()
</script>
