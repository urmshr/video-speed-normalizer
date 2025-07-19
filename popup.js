document.addEventListener("DOMContentLoaded", () => {
  const tagsList = document.getElementById("tagsList");
  const tagInput = document.getElementById("tagInput");
  const addTagBtn = document.getElementById("addTagBtn");
  const resetButton = document.getElementById("reset");

  // デフォルトキーワード
  const INITIAL_DEFAULT_KEYWORDS = [
    "Music",
    "MV",
    "音楽",
    "歌",
    "ラップ",
    "ソング",
    "song",
    "feat.",
    "Live",
    "ライブ",
    "弾き語り",
    "カバー",
    "曲",
    "cover",
    "video",
    "song",
    "official",
    "lyric",
    "lyrics",
    "ツアー",
    " / ",
    " - ",
    "コント",
    "漫才",
    "落語",
    "ネタ",
  ];

  let currentKeywords = [];
  let isInputVisible = false;
  let isComposing = false;

  // 自動保存
  function autoSave() {
    chrome.storage.sync.set({ keywords: currentKeywords }, () => {});
  }

  // 入力フィールドの表示/非表示を切り替え
  function toggleInput() {
    if (isInputVisible) {
      addTagBtn.style.display = "inline-flex";
      tagInput.style.display = "none";
      isInputVisible = false;
    } else {
      addTagBtn.style.display = "none";
      tagInput.style.display = "inline-block";
      tagInput.focus();
      isInputVisible = true;
    }
  }

  // 入力を完了して追加ボタンに戻る
  function finishInput() {
    const keyword = tagInput.value;
    if (keyword) {
      addTag(keyword);
    }
    tagInput.value = "";
    toggleInput();
  }

  // タグを作成する関数
  function createTag(keyword) {
    const tag = document.createElement("div");
    tag.className = "tag";

    const text = document.createElement("span");
    text.className = "tag-text";
    text.textContent = keyword;

    const removeBtn = document.createElement("button");
    removeBtn.className = "tag-remove";
    removeBtn.innerHTML = "×";
    removeBtn.setAttribute("aria-label", "キーワードを削除");
    removeBtn.addEventListener("click", () => removeTag(keyword));

    tag.appendChild(text);
    tag.appendChild(removeBtn);

    return tag;
  }

  // タグを表示する関数
  function renderTags() {
    tagsList.innerHTML = "";

    if (currentKeywords.length === 0) {
      const emptyMessage = document.createElement("div");
      emptyMessage.className = "empty-message";
      emptyMessage.textContent = "キーワードが設定されていません";
      emptyMessage.style.cssText = `
        color: #333;
        font-size: 13px;
        padding: 8px 4px;
      `;
      tagsList.appendChild(emptyMessage);
    } else {
      currentKeywords.forEach((keyword) => {
        if (keyword.trim()) {
          tagsList.appendChild(createTag(keyword));
        }
      });
    }
  }

  // タグを追加する関数
  function addTag(keyword) {
    if (keyword && !currentKeywords.includes(keyword)) {
      currentKeywords.push(keyword);
      renderTags();
      autoSave();
    }
  }

  // タグを削除する関数
  function removeTag(keyword) {
    const newKeywords = currentKeywords.filter((k) => k !== keyword);
    if (newKeywords.length === 0 && currentKeywords.length > 0) {
      if (
        !confirm(
          "全てのキーワードを削除すると、どの動画も速度制御されなくなります。削除しますか？"
        )
      ) {
        return;
      }
    }

    currentKeywords = newKeywords;
    renderTags();
    autoSave();
  }

  // 現在の設定を読み込み
  chrome.storage.sync.get({ keywords: null }, ({ keywords }) => {
    if (keywords === null) {
      currentKeywords = [...INITIAL_DEFAULT_KEYWORDS];
      chrome.storage.sync.set({ keywords: INITIAL_DEFAULT_KEYWORDS });
    } else if (Array.isArray(keywords)) {
      currentKeywords = [...keywords];
    }
    renderTags();
  });

  // 追加ボタンのクリックイベント
  addTagBtn.addEventListener("click", toggleInput);

  // 入力フィールドのイベントリスナー
  tagInput.addEventListener("compositionstart", () => {
    isComposing = true;
  });

  tagInput.addEventListener("compositionend", () => {
    isComposing = false;
  });

  tagInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      if (!isComposing) {
        e.preventDefault();
        finishInput();
      }
    }
  });

  // 入力フィールドからフォーカスが外れた時の処理
  tagInput.addEventListener("blur", () => {
    setTimeout(() => {
      if (isInputVisible) {
        finishInput();
      }
    }, 150);
  });

  // リセットボタン
  resetButton.addEventListener("click", () => {
    if (confirm("デフォルトのキーワードにリセットしますか？")) {
      currentKeywords = [...INITIAL_DEFAULT_KEYWORDS];
      renderTags();
      autoSave();
    }
  });
});
