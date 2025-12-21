export const INITIAL_DEFAULT_KEYWORDS = [
  "Music",
  "MV",
  "音楽",
  "歌",
  "曲",
  "ラップ",
  "ソング",
  "song",
  "feat.",
  "Live",
  "ライブ",
  "弾き語",
  "dance",
  "ダンス",
  "踊ってみた",
  "カバー",
  "cover",
  "video",
  "official",
  "lyric",
  "ツアー",
  "tour",
  "生誕祭",
  "コント",
  "漫才",
  "落語",
  "ネタ",
];

export const CONFIG = {
  NORMAL_SPEED: 1.0,
} as const;

export const DEFAULT_SETTINGS = {
  searchInChannel: true,
} as const;

export const SELECTORS = {
  VIDEO: "video.video-stream.html5-main-video",
  TITLE: "h1.ytd-watch-metadata yt-formatted-string",
  CHANNEL: "ytd-channel-name#channel-name yt-formatted-string a",
} as const;
