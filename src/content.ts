import { CONFIG, SELECTORS } from "./constants";
import { loadAllSettings, applyStorageChanges } from "./storage";
import type { StorageData } from "./storage";
import { evaluateMatch, evaluateEarlyMatch } from "./matcher";

(() => {
  "use strict";

  class YouTubeSpeedController {
    private readonly isProd = import.meta.env.MODE === "production";

    // 前回の動画情報
    private lastTitle = "";
    private lastChannel = "";
    private lastSpeed = 0;
    private lastVideoId = "";
    private previousTitle = "";
    private lastMatch: boolean | null = null;

    // データ取得リトライ
    private retryTimer: number | null = null;
    private retryCount = 0;

    // ユーザーが手動で設定した速度
    private userDefaultSpeed: number | null = null;
    private userOverrideActive = false;
    private userOverrideSpeed: number | null = null;

    // 速度変更中のガード / 判定確定前の仮ロック
    private isProcessing = false;
    private isDataReady = false;
    private forceNormalUntilDecision = false;
    private ignoreRatechangeUntil = 0;

    // 仮ロック用タイマー
    private provisionalTimer: number | null = null;
    private provisionalStartedAt = 0;

    // DOM 監視
    private observer: MutationObserver | null = null;
    private attachedVideos = new WeakSet<HTMLVideoElement>();

    // 設定キャッシュ
    private storageData: StorageData | null = null;
    private get settingsReady(): boolean {
      return this.storageData !== null;
    }

    private log(...args: unknown[]): void {
      if (this.isProd) return;
      console.debug("[VSN]", ...args);
    }

    // ── 初期化 ──

    constructor() {
      this.init();
    }

    private init(): void {
      this.loadSettings();
      this.setupStorageListener();

      if (this.isWatchPage()) this.startDataFetch();

      window.addEventListener("yt-navigate-finish", () => {
        if (this.isWatchPage()) {
          this.startDataFetch();
        } else {
          this.stopRetry();
        }
      });

      window.addEventListener("yt-navigate-start", () => {
        if (!this.isWatchPage()) return;
        if (this.lastMatch === true) {
          this.forceNormalUntilDecision = true;
          this.resetUserOverride();
          this.startProvisionalLock();
        }
      });

      this.setupMutationObserver();
      this.setupContentObserver();
      this.setupSpeedMenuListener();

      document.addEventListener("visibilitychange", () => {
        if (!document.hidden && this.isWatchPage()) {
          setTimeout(
            () => this.checkAndSetSpeed(),
            CONFIG.VISIBILITY_CHANGE_DELAY_MS,
          );
        }
      });

      this.processVideo();
    }

    private async loadSettings(): Promise<void> {
      try {
        this.storageData = await loadAllSettings();
      } catch {}
      if (this.isWatchPage() && this.isDataReady) {
        this.checkAndSetSpeed();
      }
    }

    private setupStorageListener(): void {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== "sync" || !this.storageData) return;

        this.storageData = applyStorageChanges(changes, this.storageData);
        this.log("settings cache updated", this.storageData);

        if (this.isDataReady) this.checkAndSetSpeed();
      });
    }

    // ── ヘルパー ──

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

    private getVideo(): HTMLVideoElement | null {
      return document.querySelector<HTMLVideoElement>(SELECTORS.VIDEO);
    }

    private getTitle(): string | null {
      return (
        document.querySelector(SELECTORS.TITLE)?.textContent?.trim() || null
      );
    }

    private getChannel(): string | null {
      const attributed = document.querySelector(SELECTORS.ATTRIBUTED_CHANNEL);
      if (attributed) return attributed.textContent?.trim() || null;
      return (
        document.querySelector(SELECTORS.CHANNEL)?.textContent?.trim() || null
      );
    }

    // ── 速度操作 ──

    private setSpeedGuarded(video: HTMLVideoElement, speed: number): void {
      if (video.playbackRate === speed) return;
      this.isProcessing = true;
      try {
        video.playbackRate = speed;
      } finally {
        this.isProcessing = false;
      }
    }

    private setSpeedWithIgnoreWindow(
      video: HTMLVideoElement,
      speed: number,
    ): void {
      this.isProcessing = true;
      try {
        video.playbackRate = speed;
        this.ignoreRatechangeUntil =
          Date.now() + CONFIG.IGNORE_RATECHANGE_DURATION_MS;
      } finally {
        this.isProcessing = false;
      }
    }

    private applyProvisionalNormal(
      video: HTMLVideoElement,
      ignoreUserOverride = false,
    ): void {
      if (!this.forceNormalUntilDecision) return;
      if (this.userOverrideActive && !ignoreUserOverride) return;
      if (video.playbackRate !== CONFIG.NORMAL_SPEED) {
        this.setSpeedWithIgnoreWindow(video, CONFIG.NORMAL_SPEED);
      }
    }

    // ── 仮ロック（判定確定前に等速を維持するタイマー） ─

    private startProvisionalLock(): void {
      if (this.provisionalTimer) return;
      this.provisionalStartedAt = Date.now();
      this.provisionalTimer = window.setInterval(() => {
        if (
          !this.forceNormalUntilDecision ||
          Date.now() - this.provisionalStartedAt > CONFIG.PROVISIONAL_MAX_MS
        ) {
          this.stopProvisionalLock();
          return;
        }
        const video = this.getVideo();
        if (video) this.applyProvisionalNormal(video, true);
      }, CONFIG.PROVISIONAL_INTERVAL_MS);
    }

    private stopProvisionalLock(): void {
      if (this.provisionalTimer) {
        clearInterval(this.provisionalTimer);
        this.provisionalTimer = null;
      }
    }

    // ── DOM 監視 ──

    private setupMutationObserver(): void {
      this.observer?.disconnect();

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
          if (this.isDataReady) this.checkAndSetSpeed();
        }

        const newChannel = this.getChannel();
        if (newChannel && newChannel !== this.lastChannel) {
          this.lastChannel = newChannel;
        }
      });

      const startObserving = () => {
        const container = document.querySelector("ytd-watch-metadata");
        if (container) {
          observer.observe(container, {
            childList: true,
            subtree: true,
            characterData: true,
          });
        } else {
          setTimeout(startObserving, CONFIG.CONTENT_OBSERVER_RETRY_MS);
        }
      };

      startObserving();
    }

    // ── 速度メニューのクリック検知 ──

    private setupSpeedMenuListener(): void {
      document.addEventListener(
        "click",
        (e) => {
          const target = e.target as HTMLElement | null;
          if (!target) return;

          const menuItem = target.closest(
            ".ytp-menuitem[role='menuitemradio']",
          );
          if (!menuItem) return;

          const label = menuItem
            .querySelector(".ytp-menuitem-label")
            ?.textContent?.trim();
          if (!label) return;

          const speed = this.parseSpeedLabel(label);
          if (speed === null) return;

          this.log("speed menu clicked", { label, speed });

          if (
            this.lastMatch === true &&
            !this.userOverrideActive &&
            speed !== CONFIG.NORMAL_SPEED
          ) {
            this.log("speed menu: user override via menu click", { speed });
            this.userOverrideActive = true;
            this.userOverrideSpeed = speed;
            this.userDefaultSpeed = speed;

            const video = this.getVideo();
            if (video) this.setSpeedGuarded(video, speed);
          }
        },
        true,
      );
    }

    private parseSpeedLabel(label: string): number | null {
      if (label === "標準" || label === "Normal") return CONFIG.NORMAL_SPEED;
      const parsed = parseFloat(label);
      return isNaN(parsed) ? null : parsed;
    }

    // ── video 要素のイベント ──

    private attachVideoListeners(video: HTMLVideoElement): void {
      if (this.attachedVideos.has(video)) return;
      this.attachedVideos.add(video);

      const provisionalAndCheck = () => {
        this.applyProvisionalNormal(video, true);
        this.checkAndSetSpeed();
      };

      const provisionalAndLock = () => {
        this.applyProvisionalNormal(video, true);
        if (this.forceNormalUntilDecision) this.startProvisionalLock();
      };

      video.addEventListener("play", provisionalAndCheck);
      video.addEventListener("loadedmetadata", provisionalAndCheck);
      video.addEventListener("loadstart", provisionalAndLock);
      video.addEventListener("emptied", provisionalAndLock);

      video.addEventListener("ratechange", () => {
        this.handleRateChange(video);
      });
    }

    private handleRateChange(video: HTMLVideoElement): void {
      const currentSpeed = video.playbackRate;

      if (!this.isProcessing) {
        const now = Date.now();

        if (now < this.ignoreRatechangeUntil) {
          if (
            (this.forceNormalUntilDecision || this.lastMatch === true) &&
            currentSpeed !== CONFIG.NORMAL_SPEED
          ) {
            this.setSpeedGuarded(video, CONFIG.NORMAL_SPEED);
          }
        } else if (!this.forceNormalUntilDecision && this.isDataReady) {
          this.handleUserSpeedChange(currentSpeed);
        }
      }

      this.lastSpeed = currentSpeed;
    }

    private handleUserSpeedChange(newSpeed: number): void {
      this.userOverrideActive = true;
      this.userOverrideSpeed = newSpeed;

      if (this.lastMatch !== true && newSpeed !== CONFIG.NORMAL_SPEED) {
        this.userDefaultSpeed = newSpeed;
      }
    }

    private processVideo(): void {
      const video = this.getVideo();
      if (video) {
        this.attachVideoListeners(video);
        this.applyProvisionalNormal(video, true);
        this.checkAndSetSpeed();
      }
    }

    // ── タイトル・チャンネルの取得 ──

    private startDataFetch(): void {
      if (!this.isWatchPage()) return;

      this.stopRetry();
      this.retryCount = 0;

      const currentVideoId = window.location.href.match(/[?&]v=([^&]+)/)?.[1];
      if (!currentVideoId) return;

      this.handleVideoTransition(currentVideoId);
      this.lastVideoId = currentVideoId;
      this.fetchData();
    }

    private handleVideoTransition(newVideoId: string): void {
      const ignoreUntil = Date.now() + CONFIG.IGNORE_RATECHANGE_DURATION_MS;

      if (this.lastVideoId && newVideoId !== this.lastVideoId) {
        this.previousTitle = this.lastTitle;
        this.lastTitle = "";
        this.lastChannel = "";
        this.isDataReady = false;
        this.resetUserOverride();
        this.forceNormalUntilDecision = this.lastMatch === true;
        this.ignoreRatechangeUntil = ignoreUntil;
        if (this.forceNormalUntilDecision) this.startProvisionalLock();
      } else if (!this.lastVideoId) {
        this.previousTitle = "";
        this.isDataReady = false;
        this.resetUserOverride();
        this.forceNormalUntilDecision = false;
        this.ignoreRatechangeUntil = ignoreUntil;
      } else {
        this.previousTitle = "";
      }
    }

    private fetchData(): void {
      let allDataFetched = true;

      const title = this.getTitle();
      if (title) {
        if (this.previousTitle && title === this.previousTitle) {
          allDataFetched = false;
        } else if (title !== this.lastTitle) {
          this.lastTitle = title;
          this.tryEarlyMatch(title);
        }
      } else {
        allDataFetched = false;
      }

      const channel = this.getChannel();
      if (channel && channel !== this.lastChannel) {
        this.lastChannel = channel;
      }

      const video = this.getVideo();
      const speed = video?.playbackRate ?? null;

      if (speed !== null) {
        if (speed !== this.lastSpeed) this.lastSpeed = speed;
      } else {
        allDataFetched = false;
      }

      if (allDataFetched) {
        this.isDataReady = true;
        this.checkAndSetSpeed();
        return;
      }

      this.retryCount++;
      if (this.retryCount >= CONFIG.MAX_RETRIES) return;

      this.retryTimer = window.setTimeout(
        () => this.fetchData(),
        CONFIG.RETRY_INTERVAL_MS,
      );
    }

    private tryEarlyMatch(title: string): void {
      if (!this.storageData) return;

      if (evaluateEarlyMatch(title, this.storageData)) {
        this.log("early match: title-based", { title });
        this.forceNormalUntilDecision = true;

        const video = this.getVideo();
        if (video && video.playbackRate !== CONFIG.NORMAL_SPEED) {
          this.setSpeedWithIgnoreWindow(video, CONFIG.NORMAL_SPEED);
        }
        this.startProvisionalLock();
      }
    }

    // ── 速度の最終判定 ──

    private checkAndSetSpeed(): void {
      if (!this.isWatchPage() || !this.settingsReady) return;

      const video = this.getVideo();

      if (!this.isDataReady) {
        if (video) {
          this.log("data not ready", {
            current: video.playbackRate,
            forceNormalUntilDecision: this.forceNormalUntilDecision,
          });
          this.applyProvisionalNormal(video, true);
        }
        return;
      }

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

      const { matched, reason } = evaluateMatch(
        this.getTitle(),
        this.getChannel(),
        this.storageData!,
        (...args) => this.log(...args),
      );

      this.lastMatch = matched;
      this.forceNormalUntilDecision = false;
      this.stopProvisionalLock();
      this.log("decision", {
        match: matched,
        reason,
        userDefaultSpeed: this.userDefaultSpeed,
      });

      try {
        if (matched) {
          if (video.playbackRate !== CONFIG.NORMAL_SPEED) {
            this.log("speed: set to normal", { from: video.playbackRate });
            video.playbackRate = CONFIG.NORMAL_SPEED;
          }
        } else if (
          this.userDefaultSpeed &&
          video.playbackRate !== this.userDefaultSpeed
        ) {
          this.log("speed: restore user default", {
            from: video.playbackRate,
            to: this.userDefaultSpeed,
          });
          video.playbackRate = this.userDefaultSpeed;
        }
      } finally {
        this.isProcessing = false;
      }
    }
  }

  new YouTubeSpeedController();
})();
