<template>
  <div class="imageUploadBox ac">
    <!-- 单图模式 -->
    <template v-if="mode == 'singleImage' || Array.isArray(parseMode(mode as string))">
      <div class="uploadBtn c fc" v-for="(item, index) in mode == 'singleImage' ? imageList.slice(0, 1) : imageList" :key="index">
        <t-tooltip v-if="item.fileType == 'image'" theme="primary" :content="item.sources == 'storyboard' ? item.prompt : item.name">
					<t-image v-if="item.sources=='assets'" :src="item.src" fit="contain" class="uploadPreview">
						<template #overlayContent>
							<div class="imageToolsWrap">
								<ImageTools :src="item.src!" position="br" />
							</div>
						</template>
					</t-image>
					<template v-else>
						<t-tooltip theme="primary" :content="item?.prompt ?? ''">
								<span style="font-size: 20px">文</span>
						</t-tooltip>
					</template>
				</t-tooltip>
				<t-tooltip theme="primary" v-else-if="item.fileType == 'audio'" :content="item?.prompt || ''">
					<div class="mediaPreview audioPreview">
						<i-acoustic size="20" />
						<span class="mediaLabel">音频</span>
					</div>
				</t-tooltip>
				<div v-else-if="item.fileType == 'video'" class="mediaPreview videoPreview">
					<video class="uploadPreview" :src="item.src" preload="metadata" muted />
				</div>
        <div class="imageTitleWrap" v-if="(item.sources == 'storyboard' || item.sources == 'video') && item.index != null">
          {{ item.sources == "video" ? `#${item.index + 1} · V${item.version ?? 1}` : `P${item.index + 1}` }}
        </div>
        <div class="clearBtn" @click="splitImage(index)">
          <i-close size="12" />
        </div>
        <div class="source">
          <t-tag size="small">
            {{ sourceLabel(item.sources) }}
          </t-tag>
        </div>
      </div>
    </template>
    <template v-else-if="mode == 'endFrameOptional' || mode == 'startFrameOptional' || mode == 'startEndRequired'">
      <div class="uploadBtn c fc" v-for="(item, index) in buildLabel" :key="item.value" @click="handleMixedAdd(item.value as 'start' | 'end')">
        <div v-if="!isEmptySlot(imageList?.[index])" style="flex: 1; width: 100%" class="ac">
          <template v-if="imageList?.[index]?.src">
            <t-tooltip v-if="imageList?.[index]?.fileType == 'image'" theme="primary" :content="imageList?.[index]?.name || ''">
              <t-image :src="imageList?.[index]!.src" fit="contain" class="uploadPreview">
                <template #overlayContent>
                  <div class="imageToolsWrap">
                    <ImageTools :src="imageList?.[index]!.src" position="br" />
                  </div>
                </template>
              </t-image>
            </t-tooltip>
            <div v-else-if="imageList?.[index]?.fileType == 'audio'" class="mediaPreview audioPreview">
              <i-acoustic size="20" />
              <span class="mediaLabel">音频</span>
            </div>
            <div v-else-if="imageList?.[index]?.fileType == 'video'" class="mediaPreview videoPreview">
              <video class="uploadPreview" :src="imageList?.[index]!.src" preload="metadata" muted />
            </div>
          </template>
          <template v-else>
            <t-tooltip theme="primary" :content="imageList?.[index]?.prompt || ''">
              <div v-if="imageList?.[index]?.fileType == 'image'" class="emptyImagePreview" aria-label="空图片"></div>
              <span v-else style="font-size: 20px">文</span>
            </t-tooltip>
          </template>
          <div
            class="imageTitleWrap"
            v-if="(imageList?.[index]?.sources == 'storyboard' || imageList?.[index]?.sources == 'video') && imageList?.[index]?.index != null">
            {{
              imageList?.[index]?.sources == "video"
                ? `#${imageList[index]?.index + 1} · V${imageList[index]?.version ?? 1}`
                : `P${imageList[index]?.index + 1}`
            }}
          </div>
          <div class="clearBtn" @click.stop="clearImage(index)">
            <i-close size="12" />
          </div>
          <div class="source">
            <t-tag size="small">
              {{ sourceLabel(imageList?.[index]?.sources) }}
            </t-tag>
          </div>
        </div>
        <template v-else>
          <i-plus size="24"></i-plus>
          {{ item.label }}
        </template>
      </div>
    </template>
    <div class="uploadBtn c fc" v-if="isShowAddImage" @click="handleMixedAdd()">
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
  const ext = src?.split(".").pop()?.toLowerCase() ?? "";
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
    if (asset.type === "audio" && asset?.sonAssets?.length) {
      return asset.sonAssets.map((sub: any) => {
        const fileType = getFileTypeByExt(sub.src);
        return {
          fileType,
          sources: "assets",
          src: sub.src,
          id: sub.id,
          name: sub.name,
          prompt: sub.prompt,
        } as UploadItem;
      });
    }
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
  gap: 8px;
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
  .uploadBtn {
    width: 80px;
    min-width: 80px;
    height: 80px;
    flex-shrink: 0;
    position: relative;
    border: 1px dashed var(--td-component-border);
    border-radius: 8px;
    &:hover {
      border-color: var(--td-text-color);
      cursor: pointer;
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
        color: var(--td-text-color-secondary);
      }
      &.audioPreview {
        background: var(--td-bg-color-secondarycontainer);
        color: var(--td-brand-color);
      }
      &.videoPreview {
        background: #000;
        overflow: hidden;
      }
    }
    .emptyImagePreview {
      width: 100%;
      height: 100%;
      border-radius: 8px;
      background: var(--td-bg-color-secondarycontainer);
      border: 1px dashed var(--td-component-border);
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
