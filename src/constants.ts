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
  "カバー",
  "コント",
  "漫才",
  "ネタ",
];

export const INITIAL_EXCLUDE_KEYWORDS: string[] = [];

export const CONFIG = {
  NORMAL_SPEED: 1.0,
  IGNORE_RATECHANGE_DURATION_MS: 1500,
  RETRY_INTERVAL_MS: 500,
  MAX_RETRIES: 10,
  PROVISIONAL_INTERVAL_MS: 100,
  PROVISIONAL_MAX_MS: 5000,
  VISIBILITY_CHANGE_DELAY_MS: 100,
  CONTENT_OBSERVER_RETRY_MS: 1000,
} as const;

export const DEFAULT_SETTINGS = {
  searchInChannel: false,
  enableTitlePatternMatch: false,
  enableOfficialArtistMatch: true,
  enableDescriptionMusicMatch: true,
} as const;

export const SELECTORS = {
  VIDEO: "video.video-stream.html5-main-video",
  TITLE: "h1.ytd-watch-metadata yt-formatted-string",
  CHANNEL: "ytd-channel-name#channel-name yt-formatted-string a",
  ATTRIBUTED_CHANNEL: "yt-attributed-string#attributed-channel-name",
  OFFICIAL_ARTIST_BADGE:
    "ytd-channel-name ytd-badge-supported-renderer badge-shape[role='img'][aria-label]",
  DESCRIPTION_MUSIC_HEADER:
    "ytd-structured-description-content-renderer ytd-rich-list-header-renderer yt-formatted-string#title",
} as const;
