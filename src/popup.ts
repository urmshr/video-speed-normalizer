import {
  INITIAL_DEFAULT_KEYWORDS,
  DEFAULT_SETTINGS,
  INITIAL_EXCLUDE_KEYWORDS,
} from "./constants";

document.addEventListener("DOMContentLoaded", () => {
  const tagsList = document.getElementById("tagsList") as HTMLDivElement;
  const tagInput = document.getElementById("tagInput") as HTMLInputElement;
  const addTagBtn = document.getElementById("addTagBtn") as HTMLButtonElement;
  const addTagForm = document.getElementById("addTagForm") as HTMLFormElement;
  const excludeTagsList = document.getElementById(
    "excludeTagsList"
  ) as HTMLDivElement;
  const excludeTagInput = document.getElementById(
    "excludeTagInput"
  ) as HTMLInputElement;
  const addExcludeTagBtn = document.getElementById(
    "addExcludeTagBtn"
  ) as HTMLButtonElement;
  const addExcludeTagForm = document.getElementById(
    "addExcludeTagForm"
  ) as HTMLFormElement;
  const resetKeywordsLink = document.getElementById(
    "resetKeywords"
  ) as HTMLSpanElement;
  const resetExcludeKeywordsLink = document.getElementById(
    "resetExcludeKeywords"
  ) as HTMLSpanElement;
  const searchInChannelCheckbox = document.getElementById(
    "searchInChannel"
  ) as HTMLInputElement;
  const enableTitlePatternCheckbox = document.getElementById(
    "enableTitlePatternMatch"
  ) as HTMLInputElement;
  const enableOfficialArtistCheckbox = document.getElementById(
    "enableOfficialArtistMatch"
  ) as HTMLInputElement;

  let currentKeywords: string[] = [];
  let currentExcludeKeywords: string[] = [];
  let isComposing = false;

  const storageAsync = {
    async getKeywords(defaultValue: string[]): Promise<string[]> {
      return new Promise<string[]>((resolve) => {
        chrome.storage.sync.get({ keywords: defaultValue }, (res) => {
          const keywords = res?.keywords;
          resolve(Array.isArray(keywords) ? keywords : defaultValue);
        });
      });
    },

    async setKeywords(keywords: string[]): Promise<void> {
      return new Promise<void>((resolve) => {
        chrome.storage.sync.set({ keywords }, () => resolve());
      });
    },

    async getExclude(defaultValue: string[]): Promise<string[]> {
      return new Promise<string[]>((resolve) => {
        chrome.storage.sync.get({ excludeKeywords: defaultValue }, (res) => {
          const keywords = (res as { excludeKeywords?: string[] | null })
            ?.excludeKeywords;
          resolve(Array.isArray(keywords) ? keywords : defaultValue);
        });
      });
    },

    async setExclude(excludeKeywords: string[]): Promise<void> {
      return new Promise<void>((resolve) => {
        chrome.storage.sync.set({ excludeKeywords }, () => resolve());
      });
    },
  } as const;

  async function autoSave(): Promise<void> {
    await storageAsync.setKeywords(currentKeywords);
  }

  async function autoSaveExclude(): Promise<void> {
    await storageAsync.setExclude(currentExcludeKeywords);
  }

  function showInput(): void {
    addTagBtn.classList.add("hidden");
    addTagForm.classList.remove("hidden");
    tagInput.focus();
  }

  function hideInput(): void {
    addTagForm.classList.add("hidden");
    addTagBtn.classList.remove("hidden");
    tagInput.value = "";
  }

  function handleAddTag(event: Event): void {
    event.preventDefault();
    if (isComposing) return;

    const keyword = tagInput.value.trim();
    if (keyword) {
      addTag(keyword);
    }
    hideInput();
  }

  function createTag(
    keyword: string,
    onRemove: (keyword: string) => void
  ): HTMLDivElement {
    const tag = document.createElement("div");
    tag.className = "tag";

    const text = document.createElement("span");
    text.className = "tag-text";
    text.textContent = keyword;

    const removeBtn = document.createElement("button");
    removeBtn.className = "tag-remove";
    removeBtn.innerHTML = "×";
    removeBtn.setAttribute("aria-label", "キーワードを削除");
    removeBtn.addEventListener("click", () => onRemove(keyword));

    tag.appendChild(text);
    tag.appendChild(removeBtn);
    return tag;
  }

  function renderTags(): void {
    tagsList.innerHTML = "";

    if (currentKeywords.length === 0) {
      const emptyMessage = document.createElement("div");
      emptyMessage.className = "empty-message";
      emptyMessage.textContent = "キーワードが設定されていません";
      tagsList.appendChild(emptyMessage);
    } else {
      currentKeywords
        .filter((keyword) => keyword.trim())
        .forEach((keyword) => {
          tagsList.appendChild(createTag(keyword, removeTag));
        });
    }
  }

  function renderExcludeTags(): void {
    excludeTagsList.innerHTML = "";

    if (currentExcludeKeywords.length === 0) {
      const emptyMessage = document.createElement("div");
      emptyMessage.className = "empty-message";
      emptyMessage.textContent = "除外キーワードが設定されていません";
      excludeTagsList.appendChild(emptyMessage);
      resetExcludeKeywordsLink.classList.add("hidden");
    } else {
      resetExcludeKeywordsLink.classList.remove("hidden");
      currentExcludeKeywords
        .filter((keyword) => keyword.trim())
        .forEach((keyword) => {
          excludeTagsList.appendChild(createTag(keyword, removeExcludeTag));
        });
    }
  }

  function addTag(keyword: string): void {
    if (keyword && !currentKeywords.includes(keyword)) {
      currentKeywords.push(keyword);
      renderTags();
      autoSave();
    }
  }

  function addExcludeTag(keyword: string): void {
    if (keyword && !currentExcludeKeywords.includes(keyword)) {
      currentExcludeKeywords.push(keyword);
      renderExcludeTags();
      autoSaveExclude();
    }
  }

  function removeTag(keyword: string): void {
    const newKeywords = currentKeywords.filter((k) => k !== keyword);

    if (newKeywords.length === 0 && currentKeywords.length > 0) {
      if (
        !confirm(
          "全てのキーワードを削除すると、どの動画も速度が変更されなくなります。削除しますか？"
        )
      ) {
        return;
      }
    }

    currentKeywords = newKeywords;
    renderTags();
    autoSave();
  }

  function removeExcludeTag(keyword: string): void {
    const newKeywords = currentExcludeKeywords.filter((k) => k !== keyword);
    currentExcludeKeywords = newKeywords;
    renderExcludeTags();
    autoSaveExclude();
  }

  (async () => {
    try {
      currentKeywords = await storageAsync.getKeywords(
        INITIAL_DEFAULT_KEYWORDS
      );
      currentExcludeKeywords = await storageAsync.getExclude(
        INITIAL_EXCLUDE_KEYWORDS
      );

      const { keywords } = await new Promise<{ keywords: string[] | null }>(
        (resolve) => {
          chrome.storage.sync.get({ keywords: null }, (res) =>
            resolve(res as { keywords: string[] | null })
          );
        }
      );

      if (keywords === null) {
        await storageAsync.setKeywords(INITIAL_DEFAULT_KEYWORDS);
      }

      const { excludeKeywords } = await new Promise<{
        excludeKeywords: string[] | null;
      }>((resolve) => {
        chrome.storage.sync.get(
          { excludeKeywords: null },
          (res) => resolve(res as { excludeKeywords: string[] | null })
        );
      });

      if (excludeKeywords === null) {
        await storageAsync.setExclude(INITIAL_EXCLUDE_KEYWORDS);
      }

      const { searchInChannel, enableTitlePatternMatch, enableOfficialArtistMatch } =
        await new Promise<{
        searchInChannel: boolean;
        enableTitlePatternMatch: boolean;
        enableOfficialArtistMatch: boolean;
      }>((resolve) => {
        chrome.storage.sync.get(
          {
            searchInChannel: DEFAULT_SETTINGS.searchInChannel,
            enableTitlePatternMatch: DEFAULT_SETTINGS.enableTitlePatternMatch,
            enableOfficialArtistMatch:
              DEFAULT_SETTINGS.enableOfficialArtistMatch,
          },
          (res) =>
            resolve(
              res as {
                searchInChannel: boolean;
                enableTitlePatternMatch: boolean;
                enableOfficialArtistMatch: boolean;
              }
            )
        );
      });
      searchInChannelCheckbox.checked = searchInChannel;
      enableTitlePatternCheckbox.checked = enableTitlePatternMatch;
      enableOfficialArtistCheckbox.checked = enableOfficialArtistMatch;
    } catch (e) {
      currentKeywords = [...INITIAL_DEFAULT_KEYWORDS];
      searchInChannelCheckbox.checked = DEFAULT_SETTINGS.searchInChannel;
      enableTitlePatternCheckbox.checked =
        DEFAULT_SETTINGS.enableTitlePatternMatch;
      enableOfficialArtistCheckbox.checked =
        DEFAULT_SETTINGS.enableOfficialArtistMatch;
      currentExcludeKeywords = [...INITIAL_EXCLUDE_KEYWORDS];
    }

    renderTags();
    renderExcludeTags();
  })();

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

  resetKeywordsLink.addEventListener("click", () => {
    if (confirm("キーワードをデフォルトに戻しますか？")) {
      currentKeywords = [...INITIAL_DEFAULT_KEYWORDS];
      renderTags();
      autoSave();
    }
  });

  resetExcludeKeywordsLink.addEventListener("click", () => {
    if (currentExcludeKeywords.length === 0) return;
    if (confirm("除外キーワードをすべて削除しますか？")) {
      currentExcludeKeywords = [...INITIAL_EXCLUDE_KEYWORDS];
      renderExcludeTags();
      autoSaveExclude();
    }
  });

  searchInChannelCheckbox.addEventListener("change", async () => {
    try {
      await chrome.storage.sync.set({
        searchInChannel: searchInChannelCheckbox.checked,
      });
    } catch (e) {
      searchInChannelCheckbox.checked = !searchInChannelCheckbox.checked;
    }
  });

  enableTitlePatternCheckbox.addEventListener("change", async () => {
    try {
      await chrome.storage.sync.set({
        enableTitlePatternMatch: enableTitlePatternCheckbox.checked,
      });
    } catch (e) {
      enableTitlePatternCheckbox.checked =
        !enableTitlePatternCheckbox.checked;
    }
  });

  enableOfficialArtistCheckbox.addEventListener("change", async () => {
    try {
      await chrome.storage.sync.set({
        enableOfficialArtistMatch: enableOfficialArtistCheckbox.checked,
      });
    } catch (e) {
      enableOfficialArtistCheckbox.checked =
        !enableOfficialArtistCheckbox.checked;
    }
  });

  // 除外キーワード用イベント
  addExcludeTagBtn.addEventListener("click", () => {
    addExcludeTagBtn.classList.add("hidden");
    addExcludeTagForm.classList.remove("hidden");
    excludeTagInput.focus();
  });

  addExcludeTagForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (isComposing) return;
    const keyword = excludeTagInput.value.trim();
    if (keyword) {
      addExcludeTag(keyword);
    }
    excludeTagInput.value = "";
    addExcludeTagForm.classList.add("hidden");
    addExcludeTagBtn.classList.remove("hidden");
  });

  excludeTagInput.addEventListener("compositionstart", () => {
    isComposing = true;
  });
  excludeTagInput.addEventListener("compositionend", () => {
    isComposing = false;
  });

  excludeTagInput.addEventListener("blur", () => {
    if (!addExcludeTagForm.classList.contains("hidden")) {
      addExcludeTagForm.requestSubmit();
    }
  });
});
