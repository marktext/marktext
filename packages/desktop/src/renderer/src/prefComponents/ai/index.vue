<template>
  <div class="pref-ai">
    <h4>{{ labels.title }}</h4>
    <p class="notes">
      {{ labels.description }}
    </p>

    <section class="ai-setting-group">
      <label>{{ labels.protocol }}</label>
      <select v-model="form.protocol">
        <option value="openai-chat-completions">
          OpenAI Chat Completions
        </option>
        <option value="anthropic-messages">
          Anthropic Messages
        </option>
      </select>
    </section>
    <section class="ai-setting-group">
      <label>{{ labels.endpoint }}</label>
      <input
        v-model="form.endpoint"
        type="url"
        autocomplete="url"
        placeholder="https://api.example.com/v1"
      >
      <small>{{ labels.endpointHint }}</small>
    </section>
    <section class="ai-setting-group">
      <label>{{ labels.model }}</label>
      <input
        v-model="form.model"
        type="text"
        autocomplete="off"
      >
    </section>
    <section class="ai-setting-group">
      <label>{{ labels.apiKey }}</label>
      <input
        v-model="apiKey"
        type="password"
        autocomplete="new-password"
        :placeholder="settings.hasApiKey ? labels.keyConfigured : labels.keyPlaceholder"
      >
      <small>{{ labels.keyHint }}</small>
    </section>

    <div class="ai-setting-actions">
      <button
        class="primary-button"
        :disabled="saving"
        @click="save"
      >
        {{ saving ? labels.saving : labels.save }}
      </button>
      <button
        class="secondary-button"
        :disabled="testing"
        @click="test"
      >
        {{ testing ? labels.testing : labels.test }}
      </button>
      <button
        class="danger-button"
        :disabled="!settings.hasApiKey"
        @click="deleteKey"
      >
        {{ labels.deleteKey }}
      </button>
    </div>
    <p
      v-if="status"
      class="status"
      :class="{ failure: !statusOk }"
    >
      {{ status }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useAiStore } from '@/store/ai'
import { getCurrentLanguage } from '@/i18n'
import type { AiConnectionSettings, AiConnectionSettingsInput } from '@shared/types/ai'

const ai = useAiStore()
const settings = ref<AiConnectionSettings>(awaitableSettings())
const form = reactive<AiConnectionSettingsInput>({
  protocol: 'openai-chat-completions',
  endpoint: '',
  model: ''
})
const apiKey = ref('')
const saving = ref(false)
const testing = ref(false)
const status = ref('')
const statusOk = ref(true)
const chinese = computed(() => getCurrentLanguage().toLowerCase().startsWith('zh'))
const labels = computed(() => chinese.value
  ? {
      title: 'AI 连接',
      description: '配置一个兼容 OpenAI Chat Completions 或 Anthropic Messages 的 HTTPS 接口。密钥只保存在本机用户数据目录，不会发送到渲染进程。',
      protocol: '协议',
      endpoint: 'API 地址 / Base URL',
      endpointHint: '支持 Base URL 或完整端点：OpenAI 的 /v1 会自动调用 /chat/completions，Anthropic 的 /anthropic 会自动调用 /v1/messages。必须使用 HTTPS。',
      model: '模型',
      apiKey: 'API 密钥',
      keyConfigured: '已配置（留空表示保持不变）',
      keyPlaceholder: '输入 API 密钥',
      keyHint: '保存后界面不会再次读取或显示密钥。',
      save: '保存',
      saving: '保存中…',
      test: '保存并测试',
      testing: '测试中…',
      deleteKey: '删除密钥'
    }
  : {
      title: 'AI Connection',
      description: 'Configure one HTTPS Base URL or complete endpoint compatible with OpenAI Chat Completions or Anthropic Messages. The key stays in the local user-data directory and never enters the renderer.',
      protocol: 'Protocol',
      endpoint: 'API endpoint / Base URL',
      endpointHint: 'Base URLs and complete endpoints are supported. An OpenAI /v1 URL resolves to /chat/completions; an Anthropic /anthropic URL resolves to /v1/messages. HTTPS is required.',
      model: 'Model',
      apiKey: 'API key',
      keyConfigured: 'Configured (leave blank to keep it)',
      keyPlaceholder: 'Enter API key',
      keyHint: 'The key is never read back or displayed after saving.',
      save: 'Save',
      saving: 'Saving…',
      test: 'Save and test',
      testing: 'Testing…',
      deleteKey: 'Delete key'
    })

function awaitableSettings (): AiConnectionSettings {
  return { protocol: 'openai-chat-completions', endpoint: '', model: '', hasApiKey: false }
}

const load = async (): Promise<void> => {
  const value = await window.electron.ipcRenderer.invoke('mt::ai::get-settings')
  settings.value = value
  form.protocol = value.protocol
  form.endpoint = value.endpoint
  form.model = value.model
  ai.settings = value
}

const input = (): AiConnectionSettingsInput => ({
  protocol: form.protocol,
  endpoint: form.endpoint,
  model: form.model,
  ...(apiKey.value.trim() ? { apiKey: apiKey.value.trim() } : {})
})

const save = async (): Promise<void> => {
  saving.value = true
  status.value = ''
  try {
    const value = await window.electron.ipcRenderer.invoke('mt::ai::save-settings', input())
    settings.value = value
    ai.settings = value
    apiKey.value = ''
    statusOk.value = true
    status.value = chinese.value ? '已保存。' : 'Saved.'
  } catch (err) {
    statusOk.value = false
    status.value = err instanceof Error ? err.message : String(err)
  } finally {
    saving.value = false
  }
}

const test = async (): Promise<void> => {
  testing.value = true
  status.value = ''
  try {
    const result = await window.electron.ipcRenderer.invoke('mt::ai::test-settings', input())
    statusOk.value = result.ok
    status.value = result.message
    if (result.ok) {
      const value = await window.electron.ipcRenderer.invoke('mt::ai::save-settings', input())
      settings.value = value
      ai.settings = value
      apiKey.value = ''
    }
  } catch (err) {
    statusOk.value = false
    status.value = err instanceof Error ? err.message : String(err)
  } finally {
    testing.value = false
  }
}

const deleteKey = async (): Promise<void> => {
  const value = await window.electron.ipcRenderer.invoke('mt::ai::delete-key')
  settings.value = value
  ai.settings = value
  apiKey.value = ''
  statusOk.value = true
  status.value = chinese.value ? '密钥已删除。' : 'Key deleted.'
}

onMounted(() => {
  load().catch(() => undefined)
})
</script>

<style scoped>
.pref-ai { max-width: 760px; }
.pref-ai .notes { max-width: 680px; line-height: 1.5; }
.ai-setting-group { display: flex; flex-direction: column; gap: 6px; margin: 20px 0; color: var(--editorColor); }
.ai-setting-group label { font-size: 14px; font-weight: 600; }
.ai-setting-group input, .ai-setting-group select { box-sizing: border-box; width: 100%; max-width: 620px; padding: 9px 10px; border: 1px solid var(--floatBorderColor); border-radius: 4px; background: var(--editorBgColor); color: var(--editorColor); font: inherit; }
.ai-setting-group small { color: var(--editorColor60); font-size: 12px; }
.ai-setting-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 28px; }
.primary-button, .secondary-button, .danger-button { padding: 8px 14px; border: 0; border-radius: 4px; cursor: pointer; font: inherit; }
.primary-button { color: #fff; background: var(--highlightThemeColor); }
.secondary-button { color: var(--editorColor); background: var(--floatHoverColor); }
.danger-button { color: #b63131; background: transparent; border: 1px solid currentColor; }
button:disabled { cursor: default; opacity: .45; }
.status { margin-top: 14px; color: var(--highlightThemeColor); }
.status.failure { color: #c33; }
</style>
