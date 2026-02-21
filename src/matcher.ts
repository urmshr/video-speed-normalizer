import { SELECTORS } from "./constants";
import type { StorageData } from "./storage";

type Logger = (...args: unknown[]) => void;

export function buildKeywordPattern(keywords: string[]): RegExp {
  const escaped = keywords
    .filter((k) => k.trim().length > 0)
    .map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

  return escaped.length === 0
    ? /$a/
    : new RegExp(`(?:${escaped.join("|")})`, "i");
}

export function isArtistTitleFormat(title: string): boolean {
  const t = title.trim();
  return (
    /[^「」『』]+[「『][^「」『』]+[」』]/.test(t) ||
    /.+?\s[-−‐‒–—－ーｰ]\s.+/.test(t) ||
    /.+?\s[\\/／]\s.+/.test(t) ||
    /.+?\s["'“”][^"'“”]+["'“”]/.test(t)
  );
}

export function hasOfficialArtistBadge(): boolean {
  const badges = document.querySelectorAll<HTMLElement>(
    SELECTORS.OFFICIAL_ARTIST_BADGE,
  );
  if (!badges.length) return false;

  const hints = ["Artist", "アーティスト"];
  for (const badge of badges) {
    const label = badge.getAttribute("aria-label")?.trim();
    if (label && hints.some((h) => label.includes(h))) return true;
  }
  return false;
}

export function hasDescriptionMusicSection(): boolean {
  const headers = document.querySelectorAll(SELECTORS.DESCRIPTION_MUSIC_HEADER);
  if (!headers.length) return false;

  const targets = ["音楽", "Music"];
  for (const header of headers) {
    const text = header.textContent?.trim();
    if (text && targets.some((t) => text.includes(t))) return true;
  }
  return false;
}

export interface MatchResult {
  matched: boolean;
  reason: string;
}

export function evaluateMatch(
  title: string | null,
  channel: string | null,
  data: StorageData,
  log: Logger,
): MatchResult {
  const {
    keywords,
    excludeKeywords,
    searchInChannel,
    enableTitlePatternMatch,
    enableOfficialArtistMatch,
    enableDescriptionMusicMatch,
  } = data;

  if (excludeKeywords.length > 0) {
    const pat = buildKeywordPattern(excludeKeywords);
    if (
      (title && pat.test(title)) ||
      (searchInChannel && channel && pat.test(channel))
    ) {
      log("match: excluded by denylist");
      return { matched: false, reason: "excluded" };
    }
  }

  if (enableOfficialArtistMatch && hasOfficialArtistBadge()) {
    log("match: official artist badge");
    return { matched: true, reason: "official artist badge" };
  }

  if (enableDescriptionMusicMatch && hasDescriptionMusicSection()) {
    log("match: description music section");
    return { matched: true, reason: "description music section" };
  }

  if (enableTitlePatternMatch && title && isArtistTitleFormat(title)) {
    log("match: artist/title format");
    return { matched: true, reason: "artist/title format" };
  }

  if (keywords.length > 0) {
    const kwPattern = buildKeywordPattern(keywords);

    if (title && kwPattern.test(title)) {
      log("match: keyword in title");
      return { matched: true, reason: "keyword in title" };
    }

    if (searchInChannel && channel && kwPattern.test(channel)) {
      log("match: keyword in channel");
      return { matched: true, reason: "keyword in channel" };
    }
  }

  log("no match");
  return { matched: false, reason: "no match" };
}

// タイトルによる先行判定
export function evaluateEarlyMatch(title: string, data: StorageData): boolean {
  const { keywords, excludeKeywords, enableTitlePatternMatch } = data;

  if (
    excludeKeywords.length > 0 &&
    buildKeywordPattern(excludeKeywords).test(title)
  ) {
    return false;
  }

  if (keywords.length > 0 && buildKeywordPattern(keywords).test(title)) {
    return true;
  }

  return enableTitlePatternMatch && isArtistTitleFormat(title);
}
