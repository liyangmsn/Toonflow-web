<template>
  <t-dialog
    placement="center"
    width="520px"
    v-model:visible="visible"
    :header="$t('settings.vendor.test.audioTitle') + ' - ' + modelName"
    :footer="false"
    @closed="handleClose">
    <div class="audioTestDialog">
      <t-alert theme="info" :message="$t('settings.vendor.test.audioHint')" />

      <div v-if="resultUrl" class="resultSection">
        <div class="resultLabel">{{ $t("settings.vendor.test.result") }}</div>
        <audio :src="resultUrl" controls preload="metadata"></audio>
        <a :href="resultUrl" target="_blank" rel="noreferrer">{{ $t("settings.vendor.test.openResult") }}</a>
      </div>
      <div v-else-if="loading" class="loadingSection">
        <t-loading size="large" :text="$t('settings.vendor.generating')" />
      </div>

      <div class="dialogFooter">
        <t-button variant="outline" @click="visible = false">{{ $t("settings.vendor.test.cancel") }}</t-button>
        <t-button theme="primary" :loading="loading" @click="handleTest">
          <template #icon><i-lightning theme="outline" /></template>
          {{ $t("settings.vendor.test.startTest") }}
        </t-button>
      </div>
    </div>
  </t-dialog>
</template>

<script setup lang="ts">
import axios from "@/utils/axios";

const props = defineProps<{
  vendorId: string;
  modelName: string;
}>();

const visible = defineModel<boolean>("modelVisible");
const loading = ref(false);
const resultUrl = ref("");

async function handleTest() {
  if (loading.value) return;
  loading.value = true;
  resultUrl.value = "";
  try {
    const { data } = await axios.post("/setting/vendorConfig/modelTest", {
      modelName: props.modelName,
      id: props.vendorId,
      type: "tts",
    });
    resultUrl.value = data;
    window.$message.success($t("settings.vendor.msg.audioGenSuccess"));
  } catch (e: any) {
    const message = e?.response?.data?.message || e?.response?.data || e?.message || String(e);
    window.$message.error(typeof message === "string" ? message : JSON.stringify(message));
  } finally {
    loading.value = false;
  }
}

function handleClose() {
  loading.value = false;
  resultUrl.value = "";
}
</script>

<style lang="scss" scoped>
.audioTestDialog {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-bottom: 4px;
}

.resultSection {
  display: flex;
  flex-direction: column;
  gap: 10px;

  .resultLabel {
    font-size: 13px;
    font-weight: 600;
    color: var(--td-text-color-secondary);
  }

  audio {
    width: 100%;
  }

  a {
    color: var(--td-brand-color);
    font-size: 13px;
  }
}

.loadingSection {
  display: flex;
  justify-content: center;
  padding: 28px 0;
}

.dialogFooter {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
