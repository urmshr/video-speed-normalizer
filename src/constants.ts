export const INITIAL_DEFAULT_KEYWORDS = [
  "music",
  "MV",
  "M/V",
  "song",
  "feat.",
  "live",
  "dance",
  "cover",
  "video",
  "official",
  "lyric",
  "tour",
  "ASMR",
  "choreography",
  "remix",
  "acoustic",
  "single",
  "音楽",
  "歌",
  "曲",
  "ツアー",
  "ラップ",
  "ソング",
  "ライブ",
  "ダンス",
  "弾き語",
  "踊ってみた",
  "叩いてみた",
  "カバー",
  "生誕祭",
  "コント",
  "漫才",
  "落語",
  "ネタ",
  "環境音",
  "立体音響",
];

export const INITIAL_EXCLUDE_KEYWORDS: string[] = [];

export const CONFIG = {
  NORMAL_SPEED: 1.0,
} as const;

export const DEFAULT_SETTINGS = {
  searchInChannel: true,
  enableTitlePatternMatch: true,
} as const;

export const SELECTORS = {
  VIDEO: "video.video-stream.html5-main-video",
  TITLE: "h1.ytd-watch-metadata yt-formatted-string",
  CHANNEL: "ytd-channel-name#channel-name yt-formatted-string a",
  ATTRIBUTED_CHANNEL: "yt-attributed-string#attributed-channel-name",
} as const;
