import { INITIAL_DEFAULT_KEYWORDS, DEFAULT_SETTINGS } from "./constants";

document.addEventListener("DOMContentLoaded", () => {
  const tagsList = document.getElementById("tagsList") as HTMLDivElement;
  const tagInput = document.getElementById("tagInput") as HTMLInputElement;
  const addTagBtn = document.getElementById("addTagBtn") as HTMLButtonElement;
  const addTagForm = document.getElementById("addTagForm") as HTMLFormElement;
  const resetButton = document.getElementById("reset") as HTMLButtonElement;
  const searchInChannelCheckbox = document.getElementById(
    "searchInChannel"
  ) as HTMLInputElement;

  let currentKeywords: string[] = [];
  let isComposing = false;

  const storageAsync = {
    async get(defaultValue: string[]): Promise<string[]> {
      return new Promise<string[]>((resolve) => {
        chrome.storage.sync.get({ keywords: defaultValue }, (res) => {
          const keywords = res?.keywords;
          resolve(Array.isArray(keywords) ? keywords : defaultValue);
        });
      });
    },

    async set(keywords: string[]): Promise<void> {
      return new Promise<void>((resolve) => {
        chrome.storage.sync.set({ keywords }, () => resolve());
      });
    },
  } as const;

  async function autoSave(): Promise<void> {
    await storageAsync.set(currentKeywords);
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

  function createTag(keyword: string): HTMLDivElement {
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
          tagsList.appendChild(createTag(keyword));
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

  function removeTag(keyword: string): void {
    const newKeywords = currentKeywords.filter((k) => k !== keyword);

    if (newKeywords.length === 0 && currentKeywords.length > 0) {
      if (
        !confirm(
          "全てのキーワードを削除すると、どの動画も速度制御されなくなります。削除しますか?"
        )
      ) {
        return;
      }
    }

    currentKeywords = newKeywords;
    renderTags();
    autoSave();
  }

  (async () => {
    try {
      currentKeywords = await storageAsync.get(INITIAL_DEFAULT_KEYWORDS);

      const { keywords } = await new Promise<{ keywords: string[] | null }>(
        (resolve) => {
          chrome.storage.sync.get({ keywords: null }, (res) =>
            resolve(res as { keywords: string[] | null })
          );
        }
      );

      if (keywords === null) {
        await storageAsync.set(INITIAL_DEFAULT_KEYWORDS);
      }

      const { searchInChannel } = await new Promise<{
        searchInChannel: boolean;
      }>((resolve) => {
        chrome.storage.sync.get(
          { searchInChannel: DEFAULT_SETTINGS.searchInChannel },
          (res) => resolve(res as { searchInChannel: boolean })
        );
      });
      searchInChannelCheckbox.checked = searchInChannel;
    } catch (e) {
      currentKeywords = [...INITIAL_DEFAULT_KEYWORDS];
      searchInChannelCheckbox.checked = DEFAULT_SETTINGS.searchInChannel;
    }

    renderTags();
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

  resetButton.addEventListener("click", () => {
    if (confirm("デフォルトのキーワードにリセットしますか?")) {
      currentKeywords = [...INITIAL_DEFAULT_KEYWORDS];
      renderTags();
      autoSave();
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
});
