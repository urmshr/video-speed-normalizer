import {
  INITIAL_DEFAULT_KEYWORDS,
  CONFIG,
  SELECTORS,
  DEFAULT_SETTINGS,
  INITIAL_EXCLUDE_KEYWORDS,
} from "./constants";

(() => {
  "use strict";

  class YouTubeSpeedController {
    private readonly isProd = import.meta.env.MODE === "production";
    private lastTitle = "";
    private lastChannel = "";
    private lastSpeed = 0;
    private lastVideoId = "";
    private previousTitle = "";
    private retryTimer: number | null = null;
    private retryCount = 0;
    private readonly maxRetries = 10;
    private readonly retryInterval = 500;
    private userDefaultSpeed: number | null = null;
    private userOverrideActive = false;
    private userOverrideSpeed: number | null = null;
    private isProcessing = false;
    private observer: MutationObserver | null = null;
    private isDataReady = false;
    private attachedVideos = new WeakSet<HTMLVideoElement>();

    private log(...args: unknown[]): void {
      if (this.isProd) return;
      console.log("[VSN]", ...args);
    }

    constructor() {
      this.init();
    }

    private init(): void {
      if (this.isWatchPage()) {
        this.startDataFetch();
      }

      window.addEventListener("yt-navigate-finish", () => {
        if (this.isWatchPage()) {
          this.startDataFetch();
        } else {
          this.stopRetry();
        }
      });

      this.setupMutationObserver();
      this.setupContentObserver();

      document.addEventListener("visibilitychange", () => {
        if (!document.hidden && this.isWatchPage()) {
          setTimeout(() => this.checkAndSetSpeed(), 100);
        }
      });

      this.processVideo();
    }

    private isWatchPage(): boolean {
      return window.location.pathname.startsWith("/watch");
    }

    private stopRetry(): void {
      if (this.retryTimer) {
        clearTimeout(this.retryTimer);
        this.retryTimer = null;
      }
    }

    private resetUserOverride(): void {
      this.userOverrideActive = false;
      this.userOverrideSpeed = null;
    }

    private setupMutationObserver(): void {
      if (this.observer) {
        this.observer.disconnect();
      }

      this.observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
          for (const node of m.addedNodes) {
            if (node.nodeType !== Node.ELEMENT_NODE) continue;

            const el = node as Element;
            const video = el.matches?.(SELECTORS.VIDEO)
              ? (el as HTMLVideoElement)
              : (el.querySelector(SELECTORS.VIDEO) as HTMLVideoElement | null);

            if (video) {
              this.attachVideoListeners(video);
              this.checkAndSetSpeed();
            }
          }
        }
      });

      if (document.body) {
        this.observer.observe(document.body, {
          childList: true,
          subtree: true,
        });
      }
    }

    private setupContentObserver(): void {
      const observer = new MutationObserver(() => {
        const newTitle = this.getTitle();
        if (newTitle && newTitle !== this.lastTitle) {
          this.lastTitle = newTitle;

          if (this.isDataReady) {
            this.checkAndSetSpeed();
          }
        }

        const newChannel = this.getChannel();
        if (newChannel && newChannel !== this.lastChannel) {
          this.lastChannel = newChannel;
        }
      });

      const startObserving = () => {
        const metadataContainer = document.querySelector("ytd-watch-metadata");
        if (metadataContainer) {
          observer.observe(metadataContainer, {
            childList: true,
            subtree: true,
            characterData: true,
          });
        } else {
          setTimeout(startObserving, 1000);
        }
      };

      startObserving();
    }

    private attachVideoListeners(video: HTMLVideoElement): void {
      if (this.attachedVideos.has(video)) return;
      this.attachedVideos.add(video);

      video.addEventListener("play", () => this.checkAndSetSpeed());
      video.addEventListener("loadedmetadata", () => this.checkAndSetSpeed());

      video.addEventListener("ratechange", () => {
        const currentSpeed = video.playbackRate;

        if (!this.isProcessing) {
          void this.handleUserSpeedChange(currentSpeed);
        }

        this.lastSpeed = currentSpeed;
      });
    }

    private async handleUserSpeedChange(newSpeed: number): Promise<void> {
      this.userOverrideActive = true;
      this.userOverrideSpeed = newSpeed;

      const isTarget = await this.isTargetMatch();

      if (!isTarget && newSpeed !== CONFIG.NORMAL_SPEED) {
        this.userDefaultSpeed = newSpeed;
      }
    }

    private processVideo(): void {
      const video = document.querySelector<HTMLVideoElement>(SELECTORS.VIDEO);
      if (video) {
        this.attachVideoListeners(video);
        this.checkAndSetSpeed();
      }
    }

    private startDataFetch(): void {
      if (!this.isWatchPage()) {
        return;
      }

      this.stopRetry();
      this.retryCount = 0;

      const currentUrl = window.location.href;
      const currentVideoId = currentUrl.match(/[?&]v=([^&]+)/)?.[1];

      if (!currentVideoId) {
        return;
      }

      // 動画切り替え時に前回の状態をクリア
      if (this.lastVideoId && currentVideoId !== this.lastVideoId) {
        this.previousTitle = this.lastTitle;
        this.lastTitle = "";
        this.lastChannel = "";
        this.isDataReady = false;
        this.resetUserOverride();
      } else if (!this.lastVideoId) {
        this.previousTitle = "";
        this.isDataReady = false;
        this.resetUserOverride();
      } else {
        this.previousTitle = "";
      }

      this.lastVideoId = currentVideoId;
      this.fetchData();
    }

    // タイトル/チャンネル/速度が揃うまでリトライ
    private fetchData(): void {
      let allDataFetched = true;

      const title = this.getTitle();
      if (title) {
        if (this.previousTitle && title === this.previousTitle) {
          allDataFetched = false;
        } else if (title !== this.lastTitle) {
          this.lastTitle = title;
        }
      } else {
        allDataFetched = false;
      }

      const channel = this.getChannel();
      if (channel) {
        if (channel !== this.lastChannel) {
          this.lastChannel = channel;
        }
      } else {
        allDataFetched = false;
      }

      const video = document.querySelector<HTMLVideoElement>(SELECTORS.VIDEO);
      const speed = video ? video.playbackRate : null;

      if (speed !== null) {
        if (speed !== this.lastSpeed) {
          this.lastSpeed = speed;
        }
      } else {
        allDataFetched = false;
      }

      if (allDataFetched) {
        this.isDataReady = true;
        this.checkAndSetSpeed();
        return;
      }

      this.retryCount++;
      if (this.retryCount >= this.maxRetries) {
        return;
      }

      this.retryTimer = window.setTimeout(
        () => this.fetchData(),
        this.retryInterval
      );
    }

    private getTitle(): string | null {
      const titleElement = document.querySelector(SELECTORS.TITLE);
      return titleElement ? titleElement.textContent?.trim() || null : null;
    }

    private getChannel(): string | null {
      const channelElement = document.querySelector(SELECTORS.CHANNEL);
      return channelElement ? channelElement.textContent?.trim() || null : null;
    }

    private async getKeywords(): Promise<string[]> {
      try {
        const { keywords } = await chrome.storage.sync.get({ keywords: null });

        if (
          keywords === null ||
          (Array.isArray(keywords) && keywords.length === 0)
        ) {
          await chrome.storage.sync.set({
            keywords: INITIAL_DEFAULT_KEYWORDS,
          });
          return INITIAL_DEFAULT_KEYWORDS;
        }

        return Array.isArray(keywords) ? keywords : INITIAL_DEFAULT_KEYWORDS;
      } catch (error) {
        return INITIAL_DEFAULT_KEYWORDS;
      }
    }

    private async getExcludeKeywords(): Promise<string[]> {
      try {
        const { excludeKeywords } = await chrome.storage.sync.get({
          excludeKeywords: null,
        });

        if (
          excludeKeywords === null ||
          (Array.isArray(excludeKeywords) && excludeKeywords.length === 0)
        ) {
          await chrome.storage.sync.set({
            excludeKeywords: INITIAL_EXCLUDE_KEYWORDS,
          });
          return INITIAL_EXCLUDE_KEYWORDS;
        }

        return Array.isArray(excludeKeywords)
          ? excludeKeywords
          : INITIAL_EXCLUDE_KEYWORDS;
      } catch (error) {
        return INITIAL_EXCLUDE_KEYWORDS;
      }
    }

    private async getSearchInChannelSetting(): Promise<boolean> {
      try {
        const { searchInChannel } = await chrome.storage.sync.get({
          searchInChannel: DEFAULT_SETTINGS.searchInChannel,
        });
        return typeof searchInChannel === "boolean"
          ? searchInChannel
          : DEFAULT_SETTINGS.searchInChannel;
      } catch (error) {
        return DEFAULT_SETTINGS.searchInChannel;
      }
    }

    private async getTitlePatternSetting(): Promise<boolean> {
      try {
        const { enableTitlePatternMatch } = await chrome.storage.sync.get({
          enableTitlePatternMatch: DEFAULT_SETTINGS.enableTitlePatternMatch,
        });
        return typeof enableTitlePatternMatch === "boolean"
          ? enableTitlePatternMatch
          : DEFAULT_SETTINGS.enableTitlePatternMatch;
      } catch (error) {
        return DEFAULT_SETTINGS.enableTitlePatternMatch;
      }
    }

    private buildKeywordPattern(keywords: string[]): RegExp {
      const escapedKeywords = keywords
        .filter((k) => k.trim().length > 0)
        .map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

      if (escapedKeywords.length === 0) {
        return /$a/;
      }

      return new RegExp(`(?:${escapedKeywords.join("|")})`, "i");
    }

    private isArtistTitleFormat(title: string): boolean {
      const normalized = title.trim();
      const quotePattern = /[^「」『』]+[「『][^「」『』]+[」』]/.test(normalized);
      const dashPattern = /.+?\s[-−‐‒–—－ーｰ]\s.+/.test(normalized);
      const slashPattern = /.+?\s[\\/／]\s.+/.test(normalized);
      return quotePattern || dashPattern || slashPattern;
    }

    // 正規表現特殊文字をエスケープしてOR結合し、パターン/例外を判定
    private async isTargetMatch(): Promise<boolean> {
      const keywords = await this.getKeywords();
      const excludeKeywords = await this.getExcludeKeywords();
      const title = this.getTitle();
      const channel = this.getChannel();
      const searchInChannel = await this.getSearchInChannelSetting();
      const useTitlePattern = await this.getTitlePatternSetting();
      const hasKeywords = Array.isArray(keywords) && keywords.length > 0;
      const hasExcludeKeywords =
        Array.isArray(excludeKeywords) && excludeKeywords.length > 0;
      const titlePattern = hasKeywords
        ? this.buildKeywordPattern(keywords)
        : null;
      const channelKeywords = hasKeywords
        ? keywords.filter((k) => k.toLowerCase() !== "official")
        : [];
      const channelPattern =
        channelKeywords.length > 0
          ? this.buildKeywordPattern(channelKeywords)
          : null;
      const artistFormatMatch =
        useTitlePattern && title && this.isArtistTitleFormat(title)
          ? true
          : false;

      const keywordMatchTitle =
        title && titlePattern ? titlePattern.test(title) : false;
      const keywordMatchChannel =
        searchInChannel && channel && channelPattern
          ? channelPattern.test(channel)
          : false;
      const excludePattern = hasExcludeKeywords
        ? this.buildKeywordPattern(excludeKeywords)
        : null;
      const excludeMatchTitle =
        title && excludePattern ? excludePattern.test(title) : false;
      const excludeMatchChannel =
        searchInChannel && channel && excludePattern
          ? excludePattern.test(channel)
          : false;

      this.log("criteria", {
        title,
        channel,
        artistFormatMatch,
        keywordMatchTitle,
        keywordMatchChannel,
        searchInChannel,
        useTitlePattern,
        channelKeywords,
        excludeKeywords,
        excludeMatchTitle,
        excludeMatchChannel,
      });

      if (excludeMatchTitle || excludeMatchChannel) {
        this.log("match: excluded by denylist");
        return false;
      }

      // ダッシュ/スラッシュ/引用符のパターンはタイトルのみで判定
      if (artistFormatMatch) {
        this.log("match: artist/title format");
        return true;
      }

      if (keywordMatchTitle) {
        this.log("match: keyword in title");
        return true;
      }

      if (keywordMatchChannel) {
        this.log("match: keyword in channel");
        return true;
      }

      this.log("no match");
      return false;
    }

    // キーワードマッチ時は1.0x、非マッチ時はユーザーのデフォルト速度に復元
    private async checkAndSetSpeed(): Promise<void> {
      if (!this.isWatchPage()) return;

      if (!this.isDataReady) {
        return;
      }

      const video = document.querySelector<HTMLVideoElement>(SELECTORS.VIDEO);
      if (!video) return;

      if (this.userOverrideActive) {
        this.log("speed: user override active", {
          current: video.playbackRate,
          override: this.userOverrideSpeed,
        });
        return;
      }

      this.isProcessing = true;

      const currentSpeed = video.playbackRate;

      if (currentSpeed !== CONFIG.NORMAL_SPEED && !this.userDefaultSpeed) {
        this.userDefaultSpeed = currentSpeed;
      }

      const isTargetMatch = await this.isTargetMatch();

      try {
        if (isTargetMatch) {
          if (video.playbackRate !== CONFIG.NORMAL_SPEED) {
            this.log("speed: set to normal", {
              from: video.playbackRate,
              reason: "match",
            });
            video.playbackRate = CONFIG.NORMAL_SPEED;
          } else {
            this.log("speed: already normal", { reason: "match" });
          }
        } else {
          if (
            this.userDefaultSpeed &&
            video.playbackRate !== this.userDefaultSpeed
          ) {
            this.log("speed: restore user default", {
              from: video.playbackRate,
              to: this.userDefaultSpeed,
              reason: "no match",
            });
            video.playbackRate = this.userDefaultSpeed;
          } else {
            this.log("speed: no change", {
              current: video.playbackRate,
              reason: "no match",
            });
          }
        }
      } finally {
        this.isProcessing = false;
      }
    }
  }

  new YouTubeSpeedController();
})();
