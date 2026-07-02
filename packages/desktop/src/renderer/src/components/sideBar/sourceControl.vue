<template>
  <div class="source-control">
    <div
      v-if="!signedIn"
      class="signed-out"
    >
      <p>{{ t('sideBar.sourceControl.signedOutHint') }}</p>
      <el-button
        type="primary"
        @click="openRepoBrowser"
      >
        {{ t('sideBar.sourceControl.signIn') }}
      </el-button>
    </div>

    <template v-else>
      <div class="header">
        <span class="user">@{{ username }}</span>
        <el-button
          link
          size="small"
          @click="openRepoBrowser"
        >
          {{ t('sideBar.sourceControl.cloneRepo') }}
        </el-button>
      </div>

      <div
        v-if="!repoPath"
        class="empty"
      >
        <p>{{ t('sideBar.sourceControl.noRepo') }}</p>
      </div>

      <template v-else>
        <el-alert
          v-if="lfsWarning"
          type="warning"
          :closable="false"
          show-icon
          :title="t('sideBar.sourceControl.lfsTitle')"
          :description="t('sideBar.sourceControl.lfsHint')"
        />

        <el-alert
          v-if="conflictFiles.length"
          type="warning"
          :closable="false"
          show-icon
          :title="t('sideBar.sourceControl.conflictTitle')"
        >
          <div>{{ conflictFiles.join(', ') }}</div>
          <el-button
            link
            size="small"
            @click="openRepoFolder"
          >
            {{ t('sideBar.sourceControl.openRepoFolder') }}
          </el-button>
        </el-alert>

        <textarea
          v-model="message"
          class="commit-message"
          :placeholder="t('sideBar.sourceControl.commitPlaceholder')"
          rows="3"
        />
        <div class="actions">
          <el-button
            type="primary"
            size="small"
            :disabled="!canCommit"
            @click="onCommit"
          >
            {{ t('sideBar.sourceControl.commit') }}
          </el-button>
          <el-button
            size="small"
            :disabled="changes.length > 0"
            :title="changes.length ? t('sideBar.sourceControl.commitFirst') : ''"
            :loading="busy"
            @click="onSync"
          >
            {{ t('sideBar.sourceControl.sync')
            }}<span v-if="ahead || behind"> ({{ ahead }}↑ {{ behind }}↓)</span>
          </el-button>
        </div>

        <ul class="changes">
          <li
            v-for="c in changes"
            :key="c.filepath"
            :class="c.status"
          >
            <el-checkbox
              :model-value="c.staged"
              @change="(v: boolean) => toggleStage(c.filepath, v)"
            />
            <span
              class="path"
              :title="c.filepath"
            >{{ c.filepath }}</span>
            <span class="badge">{{ statusLetter(c.status) }}</span>
          </li>
          <li
            v-if="!changes.length"
            class="none"
          >
            {{ t('sideBar.sourceControl.noChanges') }}
          </li>
        </ul>
      </template>
    </template>

    <repo-browser v-model="showBrowser" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { ElMessage } from 'element-plus'
import { useGithubStore } from '@/store/github'
import { useProjectStore } from '@/store/project'
import { t } from '@/i18n'
import RepoBrowser from '../github/repoBrowser.vue'

const githubStore = useGithubStore()
const { signedIn, username, repoPath, changes, ahead, behind, conflictFiles, lfsWarning, busy } =
  storeToRefs(githubStore)

const projectStore = useProjectStore()
const { projectTree } = storeToRefs(projectStore)

const message = ref('')
const showBrowser = ref(false)

const canCommit = computed(
  () => message.value.trim().length > 0 && changes.value.some((c) => c.staged)
)

onMounted(() => githubStore.refreshAuth())

// The panel serves any opened folder that is a GitHub repo (spec: UX flow
// step 3) — watch the opened project root and (re)detect.
watch(
  () => projectTree.value?.pathname ?? null,
  (root) => {
    githubStore.detectRepoForFolder(root).catch(() => {})
  },
  { immediate: true }
)

const openRepoBrowser = (): void => {
  showBrowser.value = true
}

const openRepoFolder = (): void => {
  if (repoPath.value) window.electron.shell.showItemInFolder(repoPath.value)
}

const statusLetter = (status: string): string =>
  ({ modified: 'M', untracked: 'U', deleted: 'D', added: 'A' })[status] ?? '?'

const toggleStage = (filepath: string, staged: boolean): void => {
  if (staged) githubStore.stage([filepath])
  else githubStore.unstage([filepath])
}

const onCommit = async (): Promise<void> => {
  await githubStore.commit(message.value.trim())
  message.value = ''
}

const onSync = async (): Promise<void> => {
  const result = await githubStore.sync()
  if (!result) return
  if (result.dirty) {
    ElMessage.warning(t('sideBar.sourceControl.dirtyToast'))
  } else if (result.conflict) {
    ElMessage.warning(t('sideBar.sourceControl.conflictToast'))
  } else {
    ElMessage.success(t('sideBar.sourceControl.syncedToast'))
  }
}
</script>

<style scoped>
.source-control {
  height: 100%;
  padding: 8px 10px;
  box-sizing: border-box;
  overflow-y: auto;
  font-size: 13px;
}
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.user {
  font-weight: 600;
}
.commit-message {
  width: 100%;
  box-sizing: border-box;
  resize: vertical;
  background: var(--floatBgColor);
  color: var(--editorColor);
  border: 1px solid var(--itemBgColor);
  border-radius: 4px;
  padding: 6px;
}
.actions {
  display: flex;
  gap: 6px;
  margin: 8px 0;
}
.changes {
  list-style: none;
  margin: 0;
  padding: 0;
}
.changes li {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 0;
}
.changes .path {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.changes .badge {
  opacity: 0.6;
  font-family: monospace;
}
.changes .none,
.empty,
.signed-out {
  opacity: 0.7;
  padding: 8px 0;
}
</style>
