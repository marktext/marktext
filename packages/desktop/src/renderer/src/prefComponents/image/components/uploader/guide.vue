<template>
  <details class="uploader-guide">
    <summary>{{ t('preferences.image.uploader.usageGuide.title') }}</summary>
    <section
      v-if="showInstallation"
      class="install-commands"
    >
      <p>{{ t('preferences.image.uploader.chooseInstallMethod') }}</p>
      <div
        v-for="manager in managers"
        :key="manager"
        class="guide-command"
      >
        <strong>{{ manager }}:</strong>
        <code>{{ t(`preferences.image.uploader.${manager}InstallCommand`) }}</code>
      </div>
      <p>
        <button
          type="button"
          class="plain-button guide-link"
          @click="open('https://github.com/PicGo/PicGo-Core')"
        >
          PicGo-Core <LinkIcon :size="14" />
        </button>
        {{ t('preferences.image.uploader.pleaseInstall') }}
      </p>
    </section>
    <ol class="usage-content">
      <li
        v-for="step in steps"
        :key="step.key"
      >
        <strong>{{ t(`preferences.image.uploader.usageGuide.${step.key}`) }}</strong>
        <p>{{ t(`preferences.image.uploader.usageGuide.${step.key}Description`) }}</p>
        <code>{{ step.command }}</code>
      </li>
    </ol>
    <button
      type="button"
      class="plain-button guide-link"
      @click="open('https://picgo.github.io/PicGo-Core-Doc/')"
    >
      {{ t('preferences.image.uploader.usageGuide.documentation') }} <LinkIcon :size="14" />
    </button>
  </details>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import LinkIcon from '@/components/icons/LinkIcon.vue'
defineProps<{ showInstallation: boolean }>()
const { t } = useI18n()
const managers = ['npm', 'yarn', 'pnpm'] as const
const steps = [
  { key: 'step1', command: 'picgo set uploader' },
  { key: 'step2', command: 'picgo upload /path/to/image.png' },
  { key: 'step3', command: 'picgo config' }
]
const open = (url: string): void => { window.electron.shell.openExternal(url) }
</script>

<style scoped>
.uploader-guide {
  margin: 16px 0;
  color: var(--editorColor);
  font-size: 13px;
  line-height: 1.6;
}
.uploader-guide summary { cursor: pointer; }
.guide-command {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 8px 0;
}
.uploader-guide code {
  display: inline-block;
  padding: 3px 6px;
  background: var(--codeBgColor);
  border-radius: 3px;
  user-select: all;
  overflow-wrap: anywhere;
}
.usage-content { padding-left: 20px; }
.usage-content li { margin: 12px 0; }
.usage-content p { margin: 4px 0; }
.guide-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--themeColor);
  font: inherit;
}
</style>
