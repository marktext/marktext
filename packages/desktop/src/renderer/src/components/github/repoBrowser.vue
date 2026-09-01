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
        <div class="code-row">
          <span class="code">{{ deviceCode }}</span>
          <el-button
            :icon="CopyDocument"
            size="small"
            :title="t('sideBar.sourceControl.copyCode')"
            @click="copyCode"
          >
            {{ t('sideBar.sourceControl.copyCode') }}
          </el-button>
        </div>
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
          <span
            class="name"
            :title="repo.fullName"
          >{{ repo.fullName }}</span>
          <el-tag
            v-if="repo.private"
            size="small"
            type="info"
            effect="plain"
          >
            {{ t('sideBar.sourceControl.private') }}
          </el-tag>
          <el-button
            size="small"
            :loading="cloningRepo === repo.fullName"
            :disabled="cloningRepo !== null && cloningRepo !== repo.fullName"
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
import { CopyDocument } from '@element-plus/icons-vue'
import { useGithubStore } from '@/store/github'
import { t } from '@/i18n'
import type { GitHubRepoInfo } from '@shared/types/ipc'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()

const githubStore = useGithubStore()
const { signedIn, repos, authError } = storeToRefs(githubStore)

const deviceCode = ref('')
const verificationUri = ref('')
const filter = ref('')
// Track which repo is currently cloning so only its button shows a spinner
// (the shared store `busy` flag would spin every row's button at once).
const cloningRepo = ref<string | null>(null)

const filtered = computed<GitHubRepoInfo[]>(() => {
  const q = filter.value.toLowerCase()
  return repos.value.filter((r) => r.fullName.toLowerCase().includes(q))
})

watch(
  () => props.modelValue,
  async (open) => {
    if (!open) {
      // Reset the device-code view so a stale code isn't shown next time.
      deviceCode.value = ''
      verificationUri.value = ''
      return
    }
    try {
      await githubStore.refreshAuth()
      if (signedIn.value) await githubStore.loadRepos()
    } catch (err) {
      // e.g. 401 after the user revoked the OAuth grant — without this the
      // dialog silently renders a misleading "No repositories" empty state.
      ElMessage.error(`${t('sideBar.sourceControl.loadReposFailed')}: ${(err as Error).message}`)
    }
  }
)

// A failed device-flow poll (denied/expired) pushes auth-error from main:
// surface it and clear the dead code so Sign in becomes available again.
watch(authError, (msg) => {
  if (!msg) return
  ElMessage.error(`${t('sideBar.sourceControl.signInFailed')}: ${msg}`)
  deviceCode.value = ''
  verificationUri.value = ''
})

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

const copyCode = (): void => {
  window.electron.clipboard.writeText(deviceCode.value)
  ElMessage.success(t('sideBar.sourceControl.copiedCode'))
}

const clone = async (repo: GitHubRepoInfo): Promise<void> => {
  // Reuse the main-process native directory picker (spec: UX flow step 2).
  const targetDir = await window.github.chooseDir()
  // Cancelling the picker returns null — a normal action, not an error.
  if (!targetDir) return
  cloningRepo.value = repo.fullName
  try {
    const localPath = await githubStore.cloneRepo(repo.cloneUrl, targetDir)
    // Main opens the cloned folder; point the panel at it too.
    await githubStore.setRepo(localPath)
    emit('update:modelValue', false)
    ElMessage.success(t('sideBar.sourceControl.cloned', { repo: repo.fullName }))
  } catch (err) {
    ElMessage.error(`${t('sideBar.sourceControl.cloneFailed')}: ${(err as Error).message}`)
  } finally {
    cloningRepo.value = null
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
  padding: 6px 4px;
  border-bottom: 1px solid var(--itemBgColor);
  border-radius: 4px;
}
.repos li:hover {
  background: var(--itemBgColor);
}
.repos .name {
  flex: 1;
  /* min-width:0 lets the name shrink so the tag + button never get pushed
     off the row; overflow then truncates instead. */
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.repos li .el-tag,
.repos li .el-button {
  flex-shrink: 0;
}
.code-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 8px 0;
}
.code {
  font-family: monospace;
  font-size: 22px;
  letter-spacing: 2px;
}
.filter {
  margin-bottom: 8px;
  width: 100%;
}
.none {
  opacity: 0.6;
}
</style>
