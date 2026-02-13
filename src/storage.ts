import {
  INITIAL_DEFAULT_KEYWORDS,
  INITIAL_EXCLUDE_KEYWORDS,
  DEFAULT_SETTINGS,
} from "./constants";

export type AppSettings = {
  [K in keyof typeof DEFAULT_SETTINGS]: boolean;
};

export type StorageData = {
  keywords: string[];
  excludeKeywords: string[];
} & { [K in keyof AppSettings]: AppSettings[K] };

function asStringArray(value: unknown, fallback: string[]): string[] {
  return Array.isArray(value) ? value : fallback;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

// 未設定 or 空配列ならデフォルト値をストレージに書き込んで返す
async function resolveKeywords(
  stored: unknown,
  storageKey: string,
  defaults: string[],
): Promise<string[]> {
  if (stored === null || (Array.isArray(stored) && stored.length === 0)) {
    await chrome.storage.sync.set({ [storageKey]: defaults });
    return defaults;
  }
  return asStringArray(stored, defaults);
}

function parseBooleanSettings(raw: Record<string, unknown>): AppSettings {
  return {
    searchInChannel: asBoolean(
      raw.searchInChannel,
      DEFAULT_SETTINGS.searchInChannel,
    ),
    enableTitlePatternMatch: asBoolean(
      raw.enableTitlePatternMatch,
      DEFAULT_SETTINGS.enableTitlePatternMatch,
    ),
    enableOfficialArtistMatch: asBoolean(
      raw.enableOfficialArtistMatch,
      DEFAULT_SETTINGS.enableOfficialArtistMatch,
    ),
    enableDescriptionMusicMatch: asBoolean(
      raw.enableDescriptionMusicMatch,
      DEFAULT_SETTINGS.enableDescriptionMusicMatch,
    ),
  };
}

export async function loadAllSettings(): Promise<StorageData> {
  const raw = await chrome.storage.sync.get({
    keywords: null,
    excludeKeywords: null,
    ...DEFAULT_SETTINGS,
  });

  const [keywords, excludeKeywords] = await Promise.all([
    resolveKeywords(raw.keywords, "keywords", INITIAL_DEFAULT_KEYWORDS),
    resolveKeywords(
      raw.excludeKeywords,
      "excludeKeywords",
      INITIAL_EXCLUDE_KEYWORDS,
    ),
  ]);

  return { keywords, excludeKeywords, ...parseBooleanSettings(raw) };
}

// storage.onChanged の差分を現在のキャッシュに反映する
export function applyStorageChanges(
  changes: Record<string, chrome.storage.StorageChange>,
  current: StorageData,
): StorageData {
  const updated = { ...current };

  if (changes.keywords) {
    updated.keywords = asStringArray(
      changes.keywords.newValue,
      INITIAL_DEFAULT_KEYWORDS,
    );
  }
  if (changes.excludeKeywords) {
    updated.excludeKeywords = asStringArray(
      changes.excludeKeywords.newValue,
      INITIAL_EXCLUDE_KEYWORDS,
    );
  }
  if (changes.searchInChannel) {
    updated.searchInChannel = asBoolean(
      changes.searchInChannel.newValue,
      DEFAULT_SETTINGS.searchInChannel,
    );
  }
  if (changes.enableTitlePatternMatch) {
    updated.enableTitlePatternMatch = asBoolean(
      changes.enableTitlePatternMatch.newValue,
      DEFAULT_SETTINGS.enableTitlePatternMatch,
    );
  }
  if (changes.enableOfficialArtistMatch) {
    updated.enableOfficialArtistMatch = asBoolean(
      changes.enableOfficialArtistMatch.newValue,
      DEFAULT_SETTINGS.enableOfficialArtistMatch,
    );
  }
  if (changes.enableDescriptionMusicMatch) {
    updated.enableDescriptionMusicMatch = asBoolean(
      changes.enableDescriptionMusicMatch.newValue,
      DEFAULT_SETTINGS.enableDescriptionMusicMatch,
    );
  }

  return updated;
}
