<template>
  <div
    v-if="hasOverflow"
    class="dragScrollHandle c"
    :class="{ dragging, visible: visible || dragging }"
    :style="{ left: `${handleLeft}px` }"
    :title="title ?? $t('components.dragScrollHandle.tip')"
    @pointerdown="startDrag">
    <i-left-two size="14" />
    <i-drag size="16" />
    <i-right-two size="14" />
  </div>
</template>

<script setup lang="ts">
/**
 * 横向滚动容器的悬浮拖动按钮。
 * 替代原生滚动条：按住按钮左右拖动，按位移比例滚动容器内容。
 * 用法：把目标滚动容器包在一个 position: relative 的父元素里，
 * 再把本组件作为该父元素的子节点，并传入滚动容器的 DOM 引用。
 */
const props = defineProps<{
  /** 目标横向滚动容器 */
  scroller?: HTMLElement | null;
  /** 自定义 title 提示，默认取 components.dragScrollHandle.tip */
  title?: string;
}>();

/** 按钮宽度，需与样式保持一致 */
const HANDLE_WIDTH = 64;
/** 按钮距容器左右边缘的最小间距 */
const EDGE_GAP = 8;

const viewportWidth = ref(0);
const maxScrollLeft = ref(0);
const progress = ref(0);
const dragging = ref(false);
const visible = ref(false);

const hasOverflow = computed(() => maxScrollLeft.value > 1);
/** 按钮可移动的最大水平位移 */
const travel = computed(() => Math.max(0, viewportWidth.value - HANDLE_WIDTH - EDGE_GAP * 2));
/** 按钮当前的 left 值，随滚动进度移动 */
const handleLeft = computed(() => EDGE_GAP + progress.value * travel.value);

let resizeObserver: ResizeObserver | null = null;
let dragStartX = 0;
let dragStartScrollLeft = 0;

/** 同步按钮位置与容器可滚动范围 */
function sync() {
  const scroller = props.scroller;
  if (!scroller || !scroller.clientWidth) {
    viewportWidth.value = 0;
    maxScrollLeft.value = 0;
    progress.value = 0;
    return;
  }

  const max = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
  viewportWidth.value = scroller.clientWidth;
  maxScrollLeft.value = max;
  progress.value = max > 0 ? Math.min(1, Math.max(0, scroller.scrollLeft / max)) : 0;
}

/** 按住按钮开始拖动 */
function startDrag(event: PointerEvent) {
  const scroller = props.scroller;
  if (!scroller || !hasOverflow.value) return;

  dragging.value = true;
  dragStartX = event.clientX;
  dragStartScrollLeft = scroller.scrollLeft;
  document.addEventListener("pointermove", handleDragMove);
  document.addEventListener("pointerup", stopDrag);
  document.addEventListener("pointercancel", stopDrag);
  (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
  event.preventDefault();
}

/** 拖动过程中按位移比例滚动内容 */
function handleDragMove(event: PointerEvent) {
  const scroller = props.scroller;
  if (!scroller || maxScrollLeft.value <= 0 || travel.value <= 0) return;

  const delta = event.clientX - dragStartX;
  scroller.scrollLeft = dragStartScrollLeft + (delta / travel.value) * maxScrollLeft.value;
}

function stopDrag() {
  dragging.value = false;
  document.removeEventListener("pointermove", handleDragMove);
  document.removeEventListener("pointerup", stopDrag);
  document.removeEventListener("pointercancel", stopDrag);
}

function showHandle() {
  visible.value = true;
}
function hideHandle() {
  visible.value = false;
}

/** 绑定滚动 / 尺寸 / 悬浮监听，容器引用变化时自动重绑 */
let boundScroller: HTMLElement | null = null;
let boundWrapper: HTMLElement | null = null;

function unbind() {
  boundScroller?.removeEventListener("scroll", sync);
  boundWrapper?.removeEventListener("pointerenter", showHandle);
  boundWrapper?.removeEventListener("pointerleave", hideHandle);
  resizeObserver?.disconnect();
  resizeObserver = null;
  boundScroller = null;
  boundWrapper = null;
}

function bind(scroller: HTMLElement) {
  boundScroller = scroller;
  // 悬浮范围取滚动容器的父级，这样鼠标移到浮在上层的按钮上也不会触发离开
  boundWrapper = scroller.parentElement;
  scroller.addEventListener("scroll", sync);
  boundWrapper?.addEventListener("pointerenter", showHandle);
  boundWrapper?.addEventListener("pointerleave", hideHandle);
  resizeObserver = new ResizeObserver(sync);
  resizeObserver.observe(scroller);
  nextTick(sync);
}

watch(
  () => props.scroller,
  (scroller) => {
    unbind();
    if (scroller) bind(scroller);
  },
  { immediate: true, flush: "post" },
);

onUnmounted(() => {
  stopDrag();
  unbind();
});

/** 内容变化后由父组件调用，重新计算可滚动范围 */
defineExpose({ sync });
</script>

<style lang="scss" scoped>
.dragScrollHandle {
  position: absolute;
  bottom: 6px;
  width: 64px;
  height: 26px;
  border-radius: 6px;
  gap: 2px;
  background: var(--td-bg-color-container);
  border: 1px solid var(--td-component-border);
  color: var(--td-text-color-secondary);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18);
  cursor: grab;
  // 默认隐藏且不拦截点击，避免遮挡下方内容
  opacity: 0;
  pointer-events: none;
  touch-action: none;
  user-select: none;
  z-index: 3;
  transition:
    opacity 0.15s ease,
    background-color 0.15s ease,
    color 0.15s ease;

  &.visible {
    opacity: 0.85;
    pointer-events: auto;
  }

  // 向外扩大命中范围，视觉尺寸不变
  &::before {
    content: "";
    position: absolute;
    inset: -8px -10px;
  }

  // 图标不参与命中，交互统一由外层按钮处理
  :deep(.i-icon) {
    pointer-events: none;
    display: flex;
  }

  &:hover,
  &.dragging {
    background: var(--td-brand-color);
    border-color: var(--td-brand-color);
    color: #fff;
  }

  &.dragging {
    opacity: 1;
    cursor: grabbing;
  }
}
</style>
