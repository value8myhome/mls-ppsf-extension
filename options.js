(() => {
  const STORAGE_KEY = "mlsPpsfSettings";
  const DEFAULT_SETTINGS = {
    checkboxSelector: "input[type='checkbox'], [role='checkbox'], [aria-checked='true'], [aria-checked='false']",
    rowSelector: "tr, [role='row'], .row, li",
    priceSelector: "",
    sqftSelector: ""
  };

  const form = document.getElementById("settings-form");
  const status = document.getElementById("status");
  const resetBtn = document.getElementById("reset");

  const fields = {
    checkboxSelector: document.getElementById("checkboxSelector"),
    rowSelector: document.getElementById("rowSelector"),
    priceSelector: document.getElementById("priceSelector"),
    sqftSelector: document.getElementById("sqftSelector")
  };

  function setStatus(message) {
    status.textContent = message;
    window.setTimeout(() => {
      if (status.textContent === message) status.textContent = "";
    }, 1800);
  }

  function setFormValues(values) {
    fields.checkboxSelector.value = values.checkboxSelector || "";
    fields.rowSelector.value = values.rowSelector || "";
    fields.priceSelector.value = values.priceSelector || "";
    fields.sqftSelector.value = values.sqftSelector || "";
  }

  function getFormValues() {
    return {
      checkboxSelector: fields.checkboxSelector.value.trim() || DEFAULT_SETTINGS.checkboxSelector,
      rowSelector: fields.rowSelector.value.trim() || DEFAULT_SETTINGS.rowSelector,
      priceSelector: fields.priceSelector.value.trim(),
      sqftSelector: fields.sqftSelector.value.trim()
    };
  }

  async function load() {
    const saved = await chrome.storage.sync.get(STORAGE_KEY);
    const merged = { ...DEFAULT_SETTINGS, ...(saved[STORAGE_KEY] || {}) };
    setFormValues(merged);
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const next = getFormValues();
    await chrome.storage.sync.set({ [STORAGE_KEY]: next });
    setStatus("Saved");
  });

  resetBtn.addEventListener("click", async () => {
    await chrome.storage.sync.set({ [STORAGE_KEY]: DEFAULT_SETTINGS });
    setFormValues(DEFAULT_SETTINGS);
    setStatus("Defaults restored");
  });

  load().catch(() => {
    setFormValues(DEFAULT_SETTINGS);
    setStatus("Using defaults");
  });
})();
