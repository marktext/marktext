<template>
  <el-dialog
    :model-value="modelValue"
    :title="t('sideBar.sourceControl.dialogTitle')"
    width="520px"
    @update:model-value="(v: boolean) => emit('update:modelValue', v)"
  >
    <div
      v-if="!signedIn"
      class="auth"
    >
      <p v-if="!deviceCode">
        {{ t('sideBar.sourceControl.signInPrompt') }}
      </p>
      <div
        v-else
        class="device"
      >
        <p>{{ t('sideBar.sourceControl.deviceCodePrompt', { uri: verificationUri }) }}</p>
        <p class="code">
          {{ deviceCode }}
        </p>
        <p class="hint">
          {{ t('sideBar.sourceControl.waiting') }}
        </p>
      </div>
      <el-button
        v-if="!deviceCode"
        type="primary"
        @click="startAuth"
      >
        {{ t('sideBar.sourceControl.signIn') }}
      </el-button>
    </div>

    <div v-else>
      <el-input
        v-model="filter"
        :placeholder="t('sideBar.sourceControl.filterPlaceholder')"
        clearable
        class="filter"
      />
      <ul class="repos">
        <li
          v-for="repo in filtered"
          :key="repo.fullName"
        >
          <span class="name">{{ repo.fullName }}</span>
          <el-tag
            v-if="repo.private"
            size="small"
          >
            {{ t('sideBar.sourceControl.private') }}
          </el-tag>
          <el-button
            size="small"
            :loading="busy"
            @click="clone(repo)"
          >
            {{ t('sideBar.sourceControl.cloneButton') }}
          </el-button>
        </li>
        <li
          v-if="!filtered.length"
          class="none"
        >
          {{ t('sideBar.sourceControl.noRepos') }}
        </li>
      </ul>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { ElMessage } from 'element-plus'
import { useGithubStore } from '@/store/github'
import { t } from '@/i18n'
import type { GitHubRepoInfo } from '@shared/types/ipc'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()

const githubStore = useGithubStore()
const { signedIn, repos, busy } = storeToRefs(githubStore)

const deviceCode = ref('')
const verificationUri = ref('')
const filter = ref('')

const filtered = computed<GitHubRepoInfo[]>(() => {
  const q = filter.value.toLowerCase()
  return repos.value.filter((r) => r.fullName.toLowerCase().includes(q))
})

watch(
  () => props.modelValue,
  async (open) => {
    if (!open) return
    await githubStore.refreshAuth()
    if (signedIn.value) await githubStore.loadRepos()
  }
)

const startAuth = async (): Promise<void> => {
  try {
    const info = await githubStore.startAuth()
    deviceCode.value = info.userCode
    verificationUri.value = info.verificationUri
    // store.onAuthSuccess (wired in the store) flips signedIn + loads repos.
  } catch (err) {
    // Surface device-flow failures (e.g. missing client id, network) as a
    // toast — otherwise the button appears to do nothing (spec: error
    // handling → user-facing toast).
    ElMessage.error(`${t('sideBar.sourceControl.signInFailed')}: ${(err as Error).message}`)
  }
}

const clone = async (repo: GitHubRepoInfo): Promise<void> => {
  // Reuse the main-process native directory picker (spec: UX flow step 2).
  const targetDir = await window.github.chooseDir()
  if (!targetDir) {
    ElMessage.error(t('sideBar.sourceControl.cloneLocationFailed'))
    return
  }
  try {
    const localPath = await githubStore.cloneRepo(repo.cloneUrl, targetDir)
    // Main opens the cloned folder; point the panel at it too.
    await githubStore.setRepo(localPath)
    emit('update:modelValue', false)
    ElMessage.success(t('sideBar.sourceControl.cloned', { repo: repo.fullName }))
  } catch (err) {
    ElMessage.error(`${t('sideBar.sourceControl.cloneFailed')}: ${(err as Error).message}`)
  }
}
</script>

<style scoped>
.repos {
  list-style: none;
  margin: 8px 0 0;
  padding: 0;
  max-height: 320px;
  overflow-y: auto;
}
.repos li {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
  border-bottom: 1px solid var(--itemBgColor);
}
.repos .name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.code {
  font-family: monospace;
  font-size: 22px;
  letter-spacing: 2px;
}
.filter {
  margin-bottom: 4px;
}
.none {
  opacity: 0.6;
}
</style>
