import { generateId, normalizeTime, useTracksStore, useHistoryStore, usePlaybackStore, type Clip, type MediaClip } from "vue-clip-track";
import type { MediaItem } from "./mediaData";
import { getDefaultDuration } from "./trackHelper";
import { loadVideoClipThumbnails, probeMediaDuration } from "./mediaLoader";

export interface ImportToMainTrackResult {
  /** 实际带入的片段数量 */
  count: number;
  /** 首个带入片段的开始时间 */
  startTime: number;
  /** 最后一个带入片段的结束时间 */
  endTime: number;
}

/** 并发补全缺失的视频时长，避免片段首尾衔接错位 */
async function fillMissingDurations(items: MediaItem[], concurrency = 4) {
  const pending = items.filter((item) => !(item.duration > 0));
  if (pending.length === 0) return;

  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, pending.length) }, async () => {
    while (cursor < pending.length) {
      const item = pending[cursor++];
      const duration = await probeMediaDuration(item.url, "video");
      if (duration > 0) item.duration = duration;
    }
  });
  await Promise.all(workers);
}

/**
 * 一键带入：把视频素材按当前顺序首尾相接地追加到主轨道。
 * 已有内容不会被覆盖，新片段从主轨道末尾接着排。
 */
export async function importVideosToMainTrack(items: MediaItem[]): Promise<ImportToMainTrackResult> {
  const tracksStore = useTracksStore();
  const historyStore = useHistoryStore();
  const playbackStore = usePlaybackStore();

  const list = (items || []).filter((item) => item && item.url);
  if (list.length === 0) return { count: 0, startTime: 0, endTime: 0 };

  const mainTrack = tracksStore.mainTrack ?? tracksStore.tracks.find((track: any) => track.type === "video");
  if (!mainTrack) throw new Error($t("workbench.production.editVideo.mainTrackNotFound"));

  await fillMissingDurations(list);

  // 从主轨道已有内容的末尾开始追加（转场不参与末尾计算）
  const startTime = mainTrack.clips.reduce(
    (max: number, clip: Clip) => (clip.type === "transition" ? max : Math.max(max, clip.endTime)),
    0,
  );

  let cursor = normalizeTime(startTime);
  const pendingThumbnails: Array<{ clipId: string; sourceUrl: string }> = [];

  for (const item of list) {
    const duration = getDefaultDuration("video", item);
    const clip: Partial<MediaClip> = {
      id: generateId("clip-"),
      trackId: mainTrack.id,
      type: "video",
      name: item.name,
      startTime: cursor,
      endTime: normalizeTime(cursor + duration),
      selected: false,
      sourceUrl: item.url,
      originalDuration: duration,
      trimStart: 0,
      trimEnd: duration,
      playbackRate: 1,
      thumbnails: item.thumbnails || [],
    };

    tracksStore.addClip(mainTrack.id, clip as Clip);
    if (!clip.thumbnails || clip.thumbnails.length === 0) {
      pendingThumbnails.push({ clipId: clip.id!, sourceUrl: item.url });
    }
    cursor = clip.endTime!;
  }

  if (cursor > playbackStore.duration) playbackStore.setDuration(cursor);
  historyStore.pushSnapshot($t("workbench.production.editVideo.oneClickImport"));
  // 把播放头移到首个新增片段，方便直接预览带入结果
  playbackStore.seekTo(normalizeTime(startTime));

  // 缩略图异步补齐，不阻塞带入结果
  pendingThumbnails.forEach(({ clipId, sourceUrl }) => loadVideoClipThumbnails(tracksStore, clipId, sourceUrl));

  return { count: list.length, startTime: normalizeTime(startTime), endTime: cursor };
}
