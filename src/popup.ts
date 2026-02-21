import {
  DEFAULT_SETTINGS,
  INITIAL_EXCLUDE_KEYWORDS,
  getInitialDefaultKeywords,
} from "./constants";
import { loadAllSettings } from "./storage";

document.addEventListener("DOMContentLoaded", () => {
  const uiLanguage = chrome.i18n.getUILanguage();
  document.documentElement.lang = uiLanguage;

  const t = (key: string): string => chrome.i18n.getMessage(key) || key;

  const applyI18n = (): void => {
    document.querySelectorAll<HTMLElement>("[data-i18n]").forEach((el) => {
      const key = el.dataset.i18n;
      if (!key) return;
      const text = t(key);
      const attr = el.dataset.i18nAttr;
      if (attr) {
        el.setAttribute(attr, text);
      } else {
        el.textContent = text;
      }
    });
  };

  applyI18n();

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
  ) as HTMLButtonElement;
  const resetExcludeKeywordsLink = document.getElementById(
    "resetExcludeKeywords"
  ) as HTMLButtonElement;
  const searchInChannelCheckbox = document.getElementById(
    "searchInChannel"
  ) as HTMLInputElement;
  const enableTitlePatternCheckbox = document.getElementById(
    "enableTitlePatternMatch"
  ) as HTMLInputElement;
  const enableOfficialArtistCheckbox = document.getElementById(
    "enableOfficialArtistMatch"
  ) as HTMLInputElement;
  const enableDescriptionMusicCheckbox = document.getElementById(
    "enableDescriptionMusicMatch"
  ) as HTMLInputElement;

  let currentKeywords: string[] = [];
  let currentExcludeKeywords: string[] = [];
  let isComposingKeyword = false;
  let isComposingExclude = false;

  async function autoSave(): Promise<void> {
    await chrome.storage.sync.set({ keywords: currentKeywords });
  }

  async function autoSaveExclude(): Promise<void> {
    await chrome.storage.sync.set({ excludeKeywords: currentExcludeKeywords });
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
    if (isComposingKeyword) return;

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
    removeBtn.setAttribute("aria-label", t("removeKeywordAria"));
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
      emptyMessage.textContent = t("emptyKeywords");
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
      emptyMessage.textContent = t("emptyExcludeKeywords");
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
          t("confirmDeleteAllKeywords")
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
      const data = await loadAllSettings();
      currentKeywords = data.keywords;
      currentExcludeKeywords = data.excludeKeywords;
      searchInChannelCheckbox.checked = data.searchInChannel;
      enableTitlePatternCheckbox.checked = data.enableTitlePatternMatch;
      enableOfficialArtistCheckbox.checked = data.enableOfficialArtistMatch;
      enableDescriptionMusicCheckbox.checked = data.enableDescriptionMusicMatch;
    } catch {
      currentKeywords = getInitialDefaultKeywords();
      currentExcludeKeywords = [...INITIAL_EXCLUDE_KEYWORDS];
      searchInChannelCheckbox.checked = DEFAULT_SETTINGS.searchInChannel;
      enableTitlePatternCheckbox.checked = DEFAULT_SETTINGS.enableTitlePatternMatch;
      enableOfficialArtistCheckbox.checked = DEFAULT_SETTINGS.enableOfficialArtistMatch;
      enableDescriptionMusicCheckbox.checked = DEFAULT_SETTINGS.enableDescriptionMusicMatch;
    }

    renderTags();
    renderExcludeTags();
  })();

  addTagBtn.addEventListener("click", showInput);
  addTagForm.addEventListener("submit", handleAddTag);

  tagInput.addEventListener("compositionstart", () => {
    isComposingKeyword = true;
  });
  tagInput.addEventListener("compositionend", () => {
    isComposingKeyword = false;
  });

  tagInput.addEventListener("blur", () => {
    if (!addTagForm.classList.contains("hidden")) {
      addTagForm.requestSubmit();
    }
  });

  resetKeywordsLink.addEventListener("click", () => {
    if (confirm(t("confirmResetKeywords"))) {
      currentKeywords = getInitialDefaultKeywords();
      renderTags();
      autoSave();
    }
  });

  resetExcludeKeywordsLink.addEventListener("click", () => {
    if (currentExcludeKeywords.length === 0) return;
    if (confirm(t("confirmClearExcludeKeywords"))) {
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

  enableDescriptionMusicCheckbox.addEventListener("change", async () => {
    try {
      await chrome.storage.sync.set({
        enableDescriptionMusicMatch: enableDescriptionMusicCheckbox.checked,
      });
    } catch (e) {
      enableDescriptionMusicCheckbox.checked =
        !enableDescriptionMusicCheckbox.checked;
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
    if (isComposingExclude) return;
    const keyword = excludeTagInput.value.trim();
    if (keyword) {
      addExcludeTag(keyword);
    }
    excludeTagInput.value = "";
    addExcludeTagForm.classList.add("hidden");
    addExcludeTagBtn.classList.remove("hidden");
  });

  excludeTagInput.addEventListener("compositionstart", () => {
    isComposingExclude = true;
  });
  excludeTagInput.addEventListener("compositionend", () => {
    isComposingExclude = false;
  });

  excludeTagInput.addEventListener("blur", () => {
    if (!addExcludeTagForm.classList.contains("hidden")) {
      addExcludeTagForm.requestSubmit();
    }
  });
});
