<template>
  <div class="textNode">
    <Handle type="source" :position="Position.Right" style="z-index: 999999" />
    <div class="data">
      <div class="title ac">
        <i-text theme="outline" size="16" fill="#000000" />
        <span class="titleText">{{ $t("workbench.production.editImage.videoDesc") }}</span>
        <t-tooltip theme="primary" :content="$t('workbench.production.editImage.deleteNode')">
          <div class="remove ac" @click="removeNodes(props.id)">
            <i-delete theme="outline" size="18" fill="#fff" />
          </div>
        </t-tooltip>
      </div>
      <div class="content" @wheel.stop>{{ data.text }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Handle, Position, useVueFlow } from "@vue-flow/core";

const props = defineProps<{
  id: string;
  data: {
    text?: string;
  };
}>();

const { removeNodes } = useVueFlow("editImage");
</script>

<style lang="scss" scoped>
.textNode {
  position: relative;
  width: 320px;
  display: flex;
  flex-direction: column;
  align-items: center;

  .data {
    width: 100%;

    .title {
      position: relative;
      height: 30px;
      padding: 5px;

      .titleText {
        margin-left: 5px;
        color: var(--td-text-color-secondary);
      }

      .remove {
        position: absolute;
        top: 0;
        right: 0;
        z-index: 9999;
        padding: 5px;
        border-radius: 10px;
        background-color: rgba(220, 50, 50, 0.7);
        cursor: pointer;
        opacity: 0;
        transition: opacity 0.2s ease;
        &:hover {
          background-color: rgba(220, 50, 50, 1);
        }
      }
    }

    .content {
      min-height: 260px;
      max-height: 320px;
      overflow: auto;
      padding: 12px;
      border: 1px solid var(--td-border-level-1-color);
      border-radius: 10px;
      background-color: var(--td-bg-color-container);
      color: var(--td-text-color-primary);
      font-size: 14px;
      line-height: 1.7;
      white-space: pre-wrap;
      word-break: break-word;
      user-select: text;
    }

    &:hover {
      .remove {
        opacity: 1;
      }
    }
  }
}
</style>
