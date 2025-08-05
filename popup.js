document.addEventListener("DOMContentLoaded", () => {
  // --- DOM要素の取得 ---
  const tagsList = document.getElementById("tagsList");
  const tagInput = document.getElementById("tagInput");
  const addTagBtn = document.getElementById("addTagBtn");
  const addTagForm = document.getElementById("addTagForm");
  const resetButton = document.getElementById("reset");

  // --- 状態管理 ---
  let currentKeywords = [];
  let isComposing = false;

  // --- 関数の定義 ---

  function autoSave() {
    chrome.storage.sync.set({ keywords: currentKeywords });
  }

  function showInput() {
    addTagBtn.classList.add("hidden");
    addTagForm.classList.remove("hidden");
    tagInput.focus();
  }

  function hideInput() {
    addTagForm.classList.add("hidden");
    addTagBtn.classList.remove("hidden");
    tagInput.value = "";
  }

  function handleAddTag(event) {
    event.preventDefault();
    if (isComposing) return;

    const keyword = tagInput.value.trim();
    if (keyword) {
      addTag(keyword);
    }
    hideInput();
  }

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

  function renderTags() {
    tagsList.innerHTML = "";
    if (currentKeywords.length === 0) {
      const emptyMessage = document.createElement("div");
      emptyMessage.className = "empty-message";
      emptyMessage.textContent = "キーワードが設定されていません";
      emptyMessage.style.cssText = `color: #333; font-size: 13px; padding: 8px 4px;`;
      tagsList.appendChild(emptyMessage);
    } else {
      currentKeywords.forEach((keyword) => {
        if (keyword.trim()) {
          tagsList.appendChild(createTag(keyword));
        }
      });
    }
  }

  function addTag(keyword) {
    if (keyword && !currentKeywords.includes(keyword)) {
      currentKeywords.push(keyword);
      renderTags();
      autoSave();
    }
  }

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

  // --- 初期化処理 ---
  chrome.storage.sync.get({ keywords: null }, ({ keywords }) => {
    if (keywords === null) {
      currentKeywords = [...INITIAL_DEFAULT_KEYWORDS];
      chrome.storage.sync.set({ keywords: INITIAL_DEFAULT_KEYWORDS });
    } else if (Array.isArray(keywords)) {
      currentKeywords = [...keywords];
    }
    renderTags();
  });

  // --- イベントリスナー ---
  addTagBtn.addEventListener("click", showInput);
  addTagForm.addEventListener("submit", handleAddTag);
  tagInput.addEventListener("compositionstart", () => {
    isComposing = true;
  });
  tagInput.addEventListener("compositionend", () => {
    isComposing = false;
  });
  tagInput.addEventListener("blur", () => {
    if (!addTagForm.classList.contains("hidden")) {
      addTagForm.requestSubmit();
    }
  });
  resetButton.addEventListener("click", () => {
    if (confirm("デフォルトのキーワードにリセットしますか？")) {
      currentKeywords = [...INITIAL_DEFAULT_KEYWORDS];
      renderTags();
      autoSave();
    }
  });
});
