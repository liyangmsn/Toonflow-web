<template>
  <t-dialog
    v-model:visible="audioGenerateShow"
    :header="$t('workbench.assets.audioGen.header')"
    width="72vw"
    top="6vh"
    :footer="false"
    @close-btn-click="handleClose">
    <div class="audioGenerationDialog">
      <div class="audioGenerationForm">
        <label>{{ $t("workbench.assets.audioGen.referenceText") }}</label>
        <t-textarea
          v-model="referenceText"
          :autosize="{ minRows: 3, maxRows: 6 }"
          :placeholder="$t('workbench.assets.audioGen.referenceTextPlaceholder')" />
        <label>{{ $t("workbench.assets.audioGen.voiceDescribe") }}</label>
        <t-textarea
          v-model="voiceDescribe"
          :autosize="{ minRows: 4, maxRows: 8 }"
          :placeholder="$t('workbench.assets.audioGen.voiceDescribePlaceholder')" />
        <t-button theme="primary" :loading="generateLoading" @click="handleGenerate">
          {{ $t("workbench.assets.audioGen.generateBtn") }}
        </t-button>
      </div>
      <div class="audioGenerationResults">
        <div class="audioGenerationResultsTitle">
          {{ $t("workbench.assets.audioGen.historyTitle", { count: results.length }) }}
        </div>
        <div v-if="results.length">
          <div v-for="item in results" :key="item.id" class="audioGenerationResult">
            <div class="audioGenerationResultMain">
              <div class="audioGenerationResultMeta">
                <strong>{{ item.name }}</strong>
                <span v-if="item.isCurrent" class="audioGenerationCurrent">{{ $t("workbench.assets.audioGen.current") }}</span>
              </div>
              <audio :src="item.src" controls preload="none"></audio>
            </div>
            <div class="audioGenerationResultActions">
              <t-button
                :theme="item.isCurrent ? 'success' : 'primary'"
                variant="outline"
                size="small"
                :disabled="item.isCurrent"
                @click="selectVersion(item)">
                {{ item.isCurrent ? $t("workbench.assets.audioGen.current") : $t("workbench.assets.audioGen.setCurrent") }}
              </t-button>
              <t-button theme="danger" variant="text" size="small" @click.stop="deleteVersion(item)">
                <template #icon>
                  <i-delete theme="outline" />
                </template>
                {{ $t("workbench.assets.audioGen.delete") }}
              </t-button>
            </div>
          </div>
        </div>
        <div v-else class="audioGenerationEmpty">{{ $t("workbench.assets.audioGen.empty") }}</div>
      </div>
    </div>
  </t-dialog>
</template>

<script setup lang="ts">
import axios from "@/utils/axios";
import projectStore from "@/stores/project";

interface AudioGenerationItem {
  id: number;
  imageId?: number;
  name: string;
  src: string;
  state?: string;
  isCurrent?: boolean;
}

const props = defineProps<{
  formData: {
    id?: number;
    name?: string;
    describe?: string;
    type?: string;
  };
}>();

const emit = defineEmits(["update"]);
const { project } = storeToRefs(projectStore());

const audioGenerateShow = defineModel({
  type: Boolean,
  default: false,
});

const results = ref<AudioGenerationItem[]>([]);
const referenceText = ref("");
const voiceDescribe = ref("");
const generateLoading = ref(false);

function handleClose() {
  audioGenerateShow.value = false;
  emit("update");
}

/** 打开时按资产信息填充默认参考文本与音色描述 */
function resetForm() {
  referenceText.value = $t("workbench.assets.audioGen.defaultReferenceText", {
    name: props.formData.name || $t("workbench.assets.audioGen.defaultAudioName"),
  });
  voiceDescribe.value = props.formData.describe || "";
}

/** 拉取历史生成结果 */
async function fetchResults() {
  if (!props.formData.id) return;
  try {
    const { data } = await axios.post("/assets/getAudioGeneration", {
      projectId: project.value?.id ?? 0,
      assetsId: props.formData.id,
    });
    results.value = data?.results ?? [];
  } catch (e: any) {
    window.$message.error(e?.message || $t("workbench.assets.audioGen.loadFail"));
  }
}

/** 生成新的音色版本 */
async function handleGenerate() {
  if (!props.formData.id) return;
  if (!referenceText.value.trim()) {
    window.$message.warning($t("workbench.assets.audioGen.inputTextTip"));
    return;
  }
  generateLoading.value = true;
  try {
    await axios.post("/assetsGenerate/generateAudio", {
      projectId: project.value?.id ?? 0,
      assetsId: props.formData.id,
      text: referenceText.value,
      describe: voiceDescribe.value,
    });
    window.$message.success($t("workbench.assets.audioGen.generateSuccess"));
    await fetchResults();
    emit("update");
  } catch (e: any) {
    window.$message.error(e?.message || $t("workbench.assets.audioGen.generateFail"));
  } finally {
    generateLoading.value = false;
  }
}

/** 将某个历史版本设为当前音色 */
async function selectVersion(item: AudioGenerationItem) {
  try {
    await axios.post("/assets/selectAudioGeneration", {
      projectId: project.value?.id ?? 0,
      assetsId: props.formData.id,
      imageId: item.id,
    });
    window.$message.success($t("workbench.assets.audioGen.switchSuccess"));
    await fetchResults();
    emit("update");
  } catch (e: any) {
    window.$message.error(e?.message || $t("workbench.assets.audioGen.switchFail"));
  }
}

/** 删除某个历史版本 */
function deleteVersion(item: AudioGenerationItem) {
  const dialog = DialogPlugin.confirm({
    header: $t("workbench.assets.audioGen.deleteHeader"),
    body: $t("workbench.assets.audioGen.deleteBody"),
    confirmBtn: $t("workbench.assets.deleteBtn"),
    cancelBtn: $t("workbench.assets.cancelBtn"),
    theme: "warning",
    onConfirm: async () => {
      try {
        await axios.post("/assets/delAudioGeneration", {
          projectId: project.value?.id ?? 0,
          assetsId: props.formData.id,
          imageId: item.id,
        });
        window.$message.success($t("workbench.assets.audioGen.deleteSuccess"));
        await fetchResults();
        emit("update");
      } catch (e: any) {
        window.$message.error(e?.message || $t("workbench.assets.audioGen.deleteFail"));
      } finally {
        dialog.destroy();
      }
    },
  });
}

watch(
  () => audioGenerateShow.value,
  (visible) => {
    if (!visible) return;
    resetForm();
    fetchResults();
  },
);
</script>

<style lang="scss" scoped>
.audioGenerationDialog {
  display: flex;
  gap: 20px;
  min-height: 512px;
}
.audioGenerationForm {
  display: flex;
  flex: 0 0 34%;
  flex-direction: column;
  gap: 10px;
  label {
    font-size: 14px;
    font-weight: 600;
    color: var(--td-text-color-primary);
  }
  :deep(.t-textarea) {
    margin-bottom: 10px;
  }
}
.audioGenerationResults {
  flex: 1;
  min-width: 0;
}
.audioGenerationResultsTitle {
  margin-bottom: 12px;
  font-size: 15px;
  font-weight: 600;
}
.audioGenerationResult {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
  padding: 12px;
  border: 1px solid var(--td-component-border);
  border-radius: 8px;
  background: var(--td-bg-color-container);
  .audioGenerationResultMain {
    flex: 1;
    min-width: 0;
    audio {
      width: 100%;
      height: 32px;
    }
  }
  .audioGenerationResultMeta {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
    strong {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .audioGenerationCurrent {
      color: var(--td-success-color);
      font-size: 12px;
    }
  }
  .audioGenerationResultActions {
    display: flex;
    align-items: center;
    gap: 4px;
  }
}
.audioGenerationEmpty {
  padding: 48px 16px;
  text-align: center;
  color: var(--td-text-color-placeholder);
}
</style>
