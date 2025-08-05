(() => {
  "use strict";

  const CONFIG = {
    NORMAL_SPEED: 1.0,
  };

  // DOM要素のセレクタ
  const SELECTORS = {
    VIDEO: "video.video-stream.html5-main-video",
    TITLE: "h1.ytd-watch-metadata yt-formatted-string",
  };

  // YouTubeの再生速度を制御するクラス
  class YouTubeSpeedController {
    // 初期化処理
    constructor() {
      this.userDefaultSpeed = null;
      this.currentTitle = "";
      this.processingUrl = "";
      this.init();
    }

    // ページ遷移時や初回ロード時に処理を開始
    init() {
      window.addEventListener("yt-navigate-finish", () =>
        this.processVideoWithDelay()
      );
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () =>
          this.processVideoWithDelay()
        );
      } else {
        this.processVideoWithDelay();
      }
    }

    // 動画タイトルの取得と速度制御処理
    async processVideoWithDelay() {
      // 現在のURLと処理中のURLを比較
      const currentUrl = window.location.href;
      if (this.processingUrl === currentUrl) return;
      this.processingUrl = currentUrl;

      let attempts = 0; // タイトル取得の試行回数
      const maxAttempts = 10; // 最大試行回数

      // タイトル取得をリトライしつつ、速度制御処理を呼び出す
      const waitForTitle = () => {
        const newTitle = this.getTitle();
        if (
          !newTitle ||
          newTitle === "YouTube" ||
          newTitle === this.currentTitle
        ) {
          attempts++;
          if (attempts < maxAttempts) {
            setTimeout(waitForTitle, 100);
            return;
          }
        }
        this.currentTitle = newTitle;
        this.checkAndSetSpeed();
      };

      waitForTitle();
    }

    // キーワードをchrome.storageから取得
    async getKeywords() {
      try {
        const { keywords } = await chrome.storage.sync.get({ keywords: null });

        // null または 空配列 の場合は初期値をセット
        if (
          keywords === null ||
          (Array.isArray(keywords) && keywords.length === 0)
        ) {
          await chrome.storage.sync.set({
            keywords: INITIAL_DEFAULT_KEYWORDS,
          });
          return INITIAL_DEFAULT_KEYWORDS;
        }

        const result = Array.isArray(keywords)
          ? keywords
          : INITIAL_DEFAULT_KEYWORDS;
        return result;
      } catch (error) {
        return INITIAL_DEFAULT_KEYWORDS;
      }
    }

    // 動画タイトルを取得
    getTitle() {
      const titleElement = document.querySelector(SELECTORS.TITLE);
      return titleElement
        ? titleElement.textContent.trim()
        : document.title.replace(/\s*-\s*YouTube\s*$/, "");
    }

    // タイトルがキーワードにマッチするか判定
    async isTargetMatch() {
      const keywords = await this.getKeywords();
      const title = this.getTitle();

      if (!keywords || keywords.length === 0) {
        return false;
      }

      const pattern = new RegExp(
        `(?:${keywords
          .map((k) => k.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&"))
          .join("|")})`,
        "i"
      );
      const result = pattern.test(title);
      return result;
    }

    // タイトルに応じて再生速度を設定
    async checkAndSetSpeed() {
      if (window.location.pathname !== "/watch") return;

      const video = document.querySelector(SELECTORS.VIDEO);

      if (!video) {
        return;
      }

      const currentSpeed = video.playbackRate;
      const title = this.getTitle();

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
    }
  }

  new YouTubeSpeedController();
})();
