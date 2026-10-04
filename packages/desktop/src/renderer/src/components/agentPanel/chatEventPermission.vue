<template>
  <div
    v-if="pending"
    class="permit"
  >
    <h3>{{ request.title }}</h3>
    <button
      v-for="option in request.options"
      :key="option.id"
      type="button"
      class="btn opt"
      @click="choose(option.id)"
    >
      {{ option.label }}
    </button>
    <p class="sys">
      {{ t('agent.permissionWait') }}
    </p>
  </div>
</template>

<script setup lang="ts">
import type { PermissionRequest } from '@shared/types/agent'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAgentStore } from '@/store/agent'

const props = defineProps<{ request: PermissionRequest }>()
const { t } = useI18n()
const agent = useAgentStore()
const pending = computed(() =>
  agent.pendingPermissions.some((item) => item.requestId === props.request.requestId)
)

const choose = (optionId: string): void => {
  agent.answerPermission(props.request.requestId, optionId).catch(() => undefined)
}
</script>
