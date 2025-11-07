import {
  INITIAL_DEFAULT_KEYWORDS,
  CONFIG,
  SELECTORS,
  DEFAULT_SETTINGS,
} from "./constants";

(() => {
  "use strict";

  class YouTubeSpeedController {
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
    private isProcessing = false;
    private observer: MutationObserver | null = null;
    private isDataReady = false;
    private attachedVideos = new WeakSet<HTMLVideoElement>();

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

        if (!this.isProcessing && currentSpeed !== CONFIG.NORMAL_SPEED) {
          this.checkIfUserSpeedChange(currentSpeed);
        }

        this.lastSpeed = currentSpeed;
      });
    }

    private async checkIfUserSpeedChange(newSpeed: number): Promise<void> {
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
      } else if (!this.lastVideoId) {
        this.previousTitle = "";
        this.isDataReady = false;
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

    // 正規表現特殊文字をエスケープしてOR結合
    private async isTargetMatch(): Promise<boolean> {
      const keywords = await this.getKeywords();
      const title = this.getTitle();
      const channel = this.getChannel();
      const searchInChannel = await this.getSearchInChannelSetting();

      if (!keywords || keywords.length === 0) {
        return false;
      }

      const escapedKeywords = keywords.map((k) =>
        k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      );

      const pattern = new RegExp(`(?:${escapedKeywords.join("|")})`, "i");

      if (title && pattern.test(title)) {
        return true;
      }

      if (searchInChannel && channel && pattern.test(channel)) {
        return true;
      }

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

      this.isProcessing = true;

      const currentSpeed = video.playbackRate;

      if (currentSpeed !== CONFIG.NORMAL_SPEED && !this.userDefaultSpeed) {
        this.userDefaultSpeed = currentSpeed;
      }

      const isTargetMatch = await this.isTargetMatch();

      if (isTargetMatch) {
        if (video.playbackRate !== CONFIG.NORMAL_SPEED) {
          video.playbackRate = CONFIG.NORMAL_SPEED;
        }
      } else {
        if (
          this.userDefaultSpeed &&
          video.playbackRate !== this.userDefaultSpeed
        ) {
          video.playbackRate = this.userDefaultSpeed;
        }
      }

      this.isProcessing = false;
    }
  }

  new YouTubeSpeedController();
})();
