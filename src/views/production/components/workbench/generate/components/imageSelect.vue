<template>
  <div class="imageUploadBox ac">
    <!-- 分组展示已选参考（分镜/片段视频按来源，资产按媒体类型），组内横向排列 -->
    <div class="referenceGroup" v-for="group in groupedReferences" :key="group.key">
      <div class="groupLabel" v-if="group.label">
        {{ group.label }}
        <span class="groupCount">{{ group.items.length }}</span>
      </div>
      <div class="groupItems ac">
        <div class="uploadBtn c fc" :class="{ audioUploadBtn: item.fileType === 'audio' }" v-for="{ item, index } in group.items" :key="index">
          <template v-if="item.src">
            <t-tooltip v-if="item.fileType == 'image'" theme="primary" :content="item.name || ''">
              <t-image :src="item.src" fit="contain" class="uploadPreview">
                <template #overlayContent>
                  <div class="imageToolsWrap">
                    <ImageTools :src="item.src!" position="br" />
                  </div>
                </template>
              </t-image>
            </t-tooltip>
            <div v-else-if="item.fileType == 'audio'" class="mediaPreview audioPreview">
							<div class="audioPreviewHeader">
								<!-- 音频卡片底部是播放器，编号放在标题行避免遮挡控件 -->
								<span class="refNumber refNumberInline" v-if="referenceNumbers.get(index)">{{ referenceNumbers.get(index) }}</span>
								<i-acoustic size="20" />
								<span class="audioPreviewName">{{ item.name }}</span>
							</div>
							<audio :src="item.src" controls preload="metadata" class="audioPlayer" />
						</div>
            <div v-else-if="item.fileType == 'video'" class="mediaPreview videoPreview">
              <video class="uploadPreview" :src="item.src" preload="metadata" muted />
            </div>
          </template>
          <template v-else>
            <t-tooltip theme="primary" :content="item?.prompt || ''">
              <span style="font-size: 20px">文</span>
            </t-tooltip>
          </template>
          <div class="imageTitleWrap" v-if="(item.sources == 'storyboard' || item.sources == 'video') && item.index != null">
            {{ item.sources == "video" ? `#${item.index + 1} · V${item.version ?? 1}` : `P${item.index + 1}` }}
          </div>
          <!-- 左下角引用编号，对应提示词里的 @图N / @视频N / @音频N -->
          <div class="refNumber" v-if="item.fileType !== 'audio' && referenceNumbers.get(index)">
            {{ referenceNumbers.get(index) }}
          </div>
          <div class="clearBtn" @click="splitImage(index)">
            <i-close size="12" />
          </div>
          <!-- 分镜/片段视频已由分组标题表达来源，只在混排的首尾帧分组里补角标 -->
          <div class="source" v-if="group.key === 'frame'">
            <t-tag size="small">
              {{ sourceLabel(item.sources) }}
            </t-tag>
          </div>
        </div>
      </div>
    </div>
    <div class="uploadBtn c fc addBtn" v-if="isShowAddImage" @click="handleMixedAdd()">
      <i-plus size="24"></i-plus>
      {{ $t("workbench.generate.addReference") }}
    </div>

    <!-- 参考来源选择弹窗 -->
    <t-dialog v-model:visible="sourceDialogVisible" :header="$t('workbench.generate.selectSource')" width="480px" placement="center">
      <template #footer>
        <div style="display: flex; justify-content: flex-end; gap: 8px">
          <t-button variant="outline" @click="openStoryboardDialog">{{ $t("workbench.generate.selectFromStoryboard") }}</t-button>
          <t-button v-if="hasVideoReferenceMode" variant="outline" @click="openReferenceVideoDialog">
            {{ $t("workbench.generate.selectFromClip") }}
          </t-button>
          <t-button theme="primary" @click="pickFromAssets">{{ $t("workbench.generate.selectFromAssets") }}</t-button>
        </div>
      </template>
    </t-dialog>

    <!-- 片段视频选择弹窗 -->
    <t-dialog
      v-model:visible="referenceVideoDialogVisible"
      :header="$t('workbench.generate.selectClipVideo')"
      :footer="false"
      width="800px"
      placement="center">
      <div class="storyboardGrid">
        <div class="storyboardItem" v-for="video in availableReferenceVideos" :key="`video:${video.id}`" @click="pickReferenceVideo(video)">
          <div class="imageTitleWrap">
            {{ `#${video.trackIndex + 1} · V${video.version ?? 1}` }}
          </div>
          <video v-if="video.src" :src="video.src" preload="metadata" muted />
          <div v-else class="textBox ac jc">{{ $t("workbench.generate.noPreview") }}</div>
        </div>
        <div v-if="!availableReferenceVideos.length" class="emptyClipVideo">{{ $t("workbench.generate.noClipVideo") }}</div>
      </div>
    </t-dialog>

    <!-- 分镜选择弹窗 -->
    <t-dialog
      v-model:visible="storyboardDialogVisible"
      :header="$t('workbench.generate.selectStoryboard')"
      :footer="false"
      width="800px"
      placement="center">
      <div class="storyboardGrid">
        <div class="storyboardItem" v-for="sb in storyboardList" :key="sb.id" @click="pickStoryboard(sb)">
          <div class="imageTitleWrap" v-if="sb?.index != null">
            {{ `P${sb?.index + 1}` }}
          </div>
          <img v-if="sb.src" :src="sb.src" />
          <div v-else class="textBox ac jc">
            <t-tooltip theme="primary" :content="sb?.videoDesc || ''">
              <span style="font-size: 20px">{{ `分镜 ${sb?.index + 1 || ""}` }}</span>
            </t-tooltip>
          </div>
        </div>
      </div>
    </t-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import "@/views/production/components/workbench/type/type";
import assetsCheck, { type AssetType, type ClipMediaType } from "@/utils/assetsCheck";
import axios from "@/utils/axios";

const props = withDefaults(
  defineProps<{
    mode: VideoMode;
    storyboardList: StoryboardItem[];
    /** 其他轨道已生成的片段视频，可作为视频参考 */
    referenceVideoList?: ReferenceVideoItem[];
    /** 当前轨道 id，用于排除自身片段 */
    currentTrackId?: number;
    /** 打开片段弹窗前刷新候选列表 */
    refreshReferenceVideos?: () => void | Promise<void>;
  }>(),
  {
    referenceVideoList: () => [],
  },
);
const imageList = defineModel<UploadItem[]>({
  default: () => [],
});
//分镜选择弹窗
const storyboardDialogVisible = ref(false);
//参考来源选择弹窗
const sourceDialogVisible = ref(false);
//片段视频选择弹窗
const referenceVideoDialogVisible = ref(false);

/** 当前模式是否支持视频参考（模式形如 videoReference 或 videoReference:2） */
const hasVideoReferenceMode = computed(() => {
  const mode = parseMode(props.mode as string);
  return Array.isArray(mode) && mode.some((m) => /^videoReference(:\d+)?$/.test(String(m)));
});

/** 可选片段视频：排除当前轨道自身的片段 */
const availableReferenceVideos = computed(() => props.referenceVideoList.filter((video) => video.trackId !== props.currentTrackId));

/** 已选项的来源标签 */
function sourceLabel(sources?: string) {
  if (sources === "storyboard") return $t("workbench.generate.storyboard");
  if (sources === "video") return $t("workbench.generate.clipVideo");
  return $t("workbench.generate.assets");
}

/** 分组展示顺序，未列出的分组排在最后 */
const GROUP_ORDER = ["source:storyboard", "source:video", "media:image", "media:video", "media:audio"];

/**
 * 计算分组 key：
 * 分镜、片段视频这类来源本身就是独立语义，单独成组；
 * 资产来源的条目再按媒体类型细分。
 */
function groupKeyOf(item: UploadItem): string {
  if (item?.sources && item.sources !== "assets") return `source:${item.sources}`;
  return `media:${item?.fileType ?? "image"}`;
}

/** 分组标题 */
function groupLabelOf(key: string): string {
  switch (key) {
    case "media:image":
      return $t("workbench.production.media.image");
    case "media:video":
      return $t("workbench.production.media.video");
    case "media:audio":
      return $t("workbench.production.media.audio");
    case "source:storyboard":
      return $t("workbench.generate.storyboard");
    case "source:video":
      return $t("workbench.generate.clipVideo");
    default:
      return sourceLabel(key.replace("source:", ""));
  }
}

/**
 * 每个条目在提示词中的引用序号（对应 @图N / @视频N / @音频N）。
 * 计数规则与 promptEditor 的 references 保持一致：跳过无 src 的项，按媒体类型分别累加。
 */
const referenceNumbers = computed(() => {
  const map = new Map<number, number>();
  const counters: Record<string, number> = {};
  imageList.value.forEach((item, index) => {
    if (!item?.src) return;
    const type = getFileTypeByExt(item.src);
    counters[type] = (counters[type] ?? 0) + 1;
    map.set(index, counters[type]);
  });
  return map;
});

/** 首尾帧类模式下槽位顺序有语义（0=首帧 1=尾帧），不做分组 */
const isFrameMode = computed(() => ["startFrameOptional", "endFrameOptional", "startEndRequired"].includes(props.mode as string));

/**
 * 分组已选参考，组内保持横向排列。
 * items 内保留原始下标 index，删除时仍作用于 imageList 的真实位置。
 */
const groupedReferences = computed(() => {
  const entries = imageList.value.map((item, index) => ({ item, index }));
  if (isFrameMode.value) {
    return entries.length ? [{ key: "frame", label: "", items: entries }] : [];
  }
  const groups = new Map<string, { item: UploadItem; index: number }[]>();
  entries.forEach(({ item, index }) => {
    const key = groupKeyOf(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push({ item, index });
  });
  return [...groups.entries()]
    .sort((a, b) => {
      const ai = GROUP_ORDER.indexOf(a[0]);
      const bi = GROUP_ORDER.indexOf(b[0]);
      return (ai === -1 ? GROUP_ORDER.length : ai) - (bi === -1 ? GROUP_ORDER.length : bi);
    })
    .map(([key, items]) => ({ key, label: groupLabelOf(key), items }));
});

/** 空占位项，用于首尾帧模式中未设置的槽位 */
const EMPTY_SLOT: UploadItem = { fileType: "image", id: null, src: "" } as any;
function isEmptySlot(item: UploadItem | undefined): boolean {
  return !item || !item.id;
}

const buildLabel = computed(() => {
  const startOptional = props.mode === "startFrameOptional";
  const endOptional = props.mode === "endFrameOptional";
  return [
    { label: startOptional ? "首帧(可选)" : "首帧", value: "start" },
    { label: endOptional ? "尾帧(可选)" : "尾帧", value: "end" },
  ];
});

/** 确保 imageList 始终有两个槽位（首帧 index=0，尾帧 index=1） */
function ensureFrameSlots(): UploadItem[] {
  const list = [...imageList.value];
  while (list.length < 2) list.push({ ...EMPTY_SLOT });
  return list;
}

/** 将 item 设置到首帧或尾帧槽位 */
function setFrameSlot(slot: "start" | "end", item: UploadItem) {
  const list = ensureFrameSlots();
  list[slot === "start" ? 0 : 1] = item;
  imageList.value = list;
}

/** 解析模式值（字符串或 JSON 数组） */
function parseMode(value: string): VideoMode | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed as ReferenceType[];
  } catch {
    return value as Exclude<VideoMode, ReferenceType[]>;
  }
  return value as Exclude<VideoMode, ReferenceType[]>;
}

//判断是否显示添加参考图
const isShowAddImage = computed(() => {
  const mode = props.mode;
  if (mode == "singleImage" && imageList.value.length >= 1) {
    return false;
  }
  if (mode == "endFrameOptional" || mode == "startEndRequired" || mode == "startFrameOptional") {
    return false;
  }
  if (mode == "text") return false;
  //多参模式默认 true
  return true;
});

/** 根据文件扩展名推断媒体类型 */
function getFileTypeByExt(src: string | undefined): "image" | "video" | "audio" {
  const cleanSrc = src?.split("?")[0].split("#")[0] ?? "";
  const ext = cleanSrc.split(".").pop()?.toLowerCase() ?? "";
  if (["mp4", "webm", "mov", "avi", "mkv"].includes(ext)) return "video";
  if (["mp3", "wav", "ogg", "aac", "flac", "m4a"].includes(ext)) return "audio";
  return "image";
}
/** 根据混合模式推导当前允许的 clip 媒体类型 */
const mixedClipMediaTypes = computed<ClipMediaType[]>(() => {
  const mode = props.mode;
  if (!Array.isArray(mode)) return [];
  const map: Record<string, ClipMediaType> = { audioReference: "audio", imageReference: "image", videoReference: "video" };
  return mode.filter((m) => m in map).map((m) => map[m]);
});
let currentSlot: "start" | "end" | "" = "";
/** 添加参考：先选来源（分镜 / 片段视频 / 资产库） */
function handleMixedAdd(slot: "start" | "end" | "" = "") {
  if (!props.mode) return window.$message.error($t("workbench.generate.notSelectMode"));
  currentSlot = slot;
  sourceDialogVisible.value = true;
}

/** 来源：从分镜选择 */
function openStoryboardDialog() {
  sourceDialogVisible.value = false;
  storyboardDialogVisible.value = true;
}

/** 来源：从片段选择（打开前刷新一次候选，确保能看到刚生成的片段） */
async function openReferenceVideoDialog() {
  sourceDialogVisible.value = false;
  try {
    await props.refreshReferenceVideos?.();
  } catch (e) {
    console.error("刷新片段视频列表失败:", e);
  }
  referenceVideoDialogVisible.value = true;
}

/** 来源：从资产库选择 */
async function pickFromAssets() {
  sourceDialogVisible.value = false;
  const slot = currentSlot;
  const multiple = Array.isArray(parseMode(props.mode as string));
  const assets = await assetsCheck({ types: ["role", "tool", "scene", "clip", "audio"], clipMediaTypes: mixedClipMediaTypes.value, multiple });

  if (!assets.length) return;

  const newItems: UploadItem[] = assets.flatMap((asset) => {
    const fileType = getFileTypeByExt(asset.src);
    return [
      {
        fileType,
        sources: "assets",
        src: asset.src,
        id: asset.id,
        name: asset.name,
        prompt: asset.prompt,
      } as UploadItem,
    ];
  });
  if (slot === "start" || slot === "end") {
    setFrameSlot(slot, newItems[0]);
  } else if (props.mode === "singleImage") {
    imageList.value = [newItems[0]];
  } else {
    const assetsNotAudioIds = newItems.filter((i) => i.fileType !== "audio");
    const { data } = await axios.post("/production/workbench/getAudioBindAssetsList", {
      assetsIds: assetsNotAudioIds.map((i) => i.id),
    });
    imageList.value = [...imageList.value, ...newItems, ...(data ?? [])];
  }
}
function clearImage(index: number) {
  const list = ensureFrameSlots();
  list[index] = { ...EMPTY_SLOT };
  imageList.value = list;
}
/** 分镜弹窗选中回调 */
function pickStoryboard(sb: StoryboardItem) {
  storyboardDialogVisible.value = false;
  const fileType = "image";
  const newItem = {
    fileType,
    sources: "storyboard",
    src: sb.src,
    id: sb.id,
    prompt: sb.videoDesc ?? undefined,
    index: sb.index,
  } as UploadItem;

  if (currentSlot === "start" || currentSlot === "end") {
    setFrameSlot(currentSlot, newItem);
  } else {
    imageList.value = [...imageList.value, newItem];
  }
}
/** 片段视频弹窗选中回调 */
function pickReferenceVideo(video: ReferenceVideoItem) {
  referenceVideoDialogVisible.value = false;
  const newItem = {
    fileType: "video",
    sources: "video",
    src: video.src,
    id: video.id,
    index: video.trackIndex,
    version: video.version,
  } as UploadItem;

  if (currentSlot === "start" || currentSlot === "end") {
    setFrameSlot(currentSlot, newItem);
  } else {
    imageList.value = [...imageList.value, newItem];
  }
}
function splitImage(index: number) {
  const list = [...imageList.value];
  list.splice(index, 1);
  imageList.value = list;
}
</script>

<style lang="scss" scoped>
.imageUploadBox {
  gap: 14px;
  color: #000;
  align-items: flex-end;
  overflow-x: auto;
  flex-wrap: nowrap;
  padding-bottom: 6px;
  &::-webkit-scrollbar {
    height: 6px;
  }
  &::-webkit-scrollbar-thumb {
    background: #696969;
    border-radius: 4px;
  }
  &::-webkit-scrollbar-track {
    background-color: var(--td-bg-color-secondarycontainer);
    border-radius: 4px;
  }
  .referenceGroup {
    display: flex;
    flex-direction: column;
    gap: 6px;
    flex-shrink: 0;
  }
  .groupLabel {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 600;
    color: #000;
    white-space: nowrap;
    .groupCount {
      font-size: 11px;
      font-weight: 500;
      color: #000;
      background: var(--td-bg-color-component);
      border-radius: 8px;
      padding: 0 6px;
      line-height: 16px;
    }
  }
  .groupItems {
    gap: 8px;
    flex-wrap: nowrap;
  }
  .imageTitleWrap {
    z-index: 999;
    position: absolute;
    left: 4px;
    top: 4px;
    padding: 0 5px;
    font-size: 11px;
    line-height: 18px;
    background: rgba(0, 0, 0, 0.55);
    color: #fff;
    border-radius: 4px;
    backdrop-filter: blur(4px);
    user-select: none;
    white-space: nowrap;
  }
  .refNumber {
    z-index: 999;
    position: absolute;
    left: 4px;
    bottom: 4px;
    min-width: 16px;
    height: 16px;
    padding: 0 4px;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    line-height: 1;
    border-radius: 4px;
    background: rgba(0, 0, 0, 0.4);
    color: rgba(255, 255, 255, 0.85);
    backdrop-filter: blur(4px);
    user-select: none;
    &.refNumberInline {
      position: static;
      flex-shrink: 0;
      background: var(--td-bg-color-component);
      color: var(--td-text-color-secondary);
    }
  }
  .uploadBtn {
    width: 80px;
    min-width: 80px;
    height: 80px;
    flex-shrink: 0;
    position: relative;
    border: 1px dashed var(--td-component-border);
    border-radius: 8px;
    color: #000;
    &:hover {
      border-color: var(--td-text-color);
      cursor: pointer;
    }
    &.addBtn {
      font-size: 12px;
      gap: 2px;
      flex-shrink: 0;
    }

    .uploadPreview {
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: 8px;
      position: relative;
      .imageToolsWrap {
        height: 100%;
        transform: scale(0.6);
        transform-origin: bottom right;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.2s ease;
      }
      &:hover {
        .imageToolsWrap {
          opacity: 1;
          pointer-events: auto;
        }
      }
    }
    .mediaPreview {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      border-radius: 8px;
      gap: 4px;
      .mediaLabel {
        font-size: 11px;
        color: #000;
      }
      &.audioPreview {
        position: relative;
        background: var(--td-bg-color-secondarycontainer);
        color: #000;
        padding: 8px;
        box-sizing: border-box;

        .audioPreviewHeader {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 6px;
          min-width: 0;
          color: var(--td-brand-color);
        }

        .audioPreviewName {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: #000;
          font-size: 12px;
        }

        .audioPlayer {
          width: 100%;
          min-width: 0;
          height: 36px;
        }
      }
      &.videoPreview {
        background: #000;
        overflow: hidden;
      }
    }
    &.audioUploadBtn {
      width: 280px;
      min-width: 280px;
    }
    .clearBtn {
      z-index: 999999999999999;
      position: absolute;
      top: 2px;
      right: 2px;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: rgba(0, 0, 0, 0.6);
      color: #fff;
      display: none;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      &:hover {
        background: rgba(0, 0, 0, 0.85);
      }
    }
    &:hover .clearBtn {
      display: flex;
    }
    .source {
      position: absolute;
      bottom: 2px;
      right: 2px;
      border-radius: 50%;
      background: rgba(0, 0, 0, 0.6);
      color: #fff;
      display: none;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      &:hover {
        background: rgba(0, 0, 0, 0.85);
      }
    }
    &:hover .source {
      display: flex;
    }
  }
  .storyboardGrid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    max-height: 60vh;
    overflow-y: auto;
    padding: 4px;
    .storyboardItem {
      cursor: pointer;
      position: relative;
      border-radius: 8px;
      overflow: hidden;
      border: 2px solid transparent;
      transition:
        border-color 0.2s,
        box-shadow 0.2s;
      &:hover {
        border-color: var(--td-brand-color);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
      }
      img,
      video {
        width: 100%;
        aspect-ratio: 16/9;
        object-fit: cover;
        display: block;
        background: #000;
      }
      .textBox {
        aspect-ratio: 16/9;
        width: 100%;
        text-align: center;
        border: 1px solid #ccc;
      }
    }
    .emptyClipVideo {
      grid-column: 1 / -1;
      padding: 32px 0;
      text-align: center;
      color: var(--td-text-color-placeholder);
    }
  }
}
</style>
