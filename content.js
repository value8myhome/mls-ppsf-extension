(() => {
  const STORAGE_KEY = "mlsPpsfSettings";
  const DEFAULT_SETTINGS = {
    checkboxSelector: "input[type='checkbox'], [role='checkbox'], [aria-checked='true'], [aria-checked='false']",
    rowSelector: "tr, [role='row'], .row, li",
    priceSelector: "",
    sqftSelector: "",
    includePending: false
  };

  let settings = { ...DEFAULT_SETTINGS };

  function parseMoney(input) {
    if (!input) return null;
    const text = String(input).toLowerCase();
    const suffixed = text.match(/(\d[\d,]*(?:\.\d+)?)\s*([mk])\b/i);
    if (suffixed) {
      const base = Number(suffixed[1].replace(/,/g, ""));
      if (!Number.isFinite(base)) return null;
      const multiplier = suffixed[2].toLowerCase() === "m" ? 1000000 : 1000;
      return base * multiplier;
    }

    const cleaned = text.replace(/,/g, "").match(/\$?\s*(\d+(?:\.\d+)?)/);
    if (!cleaned) return null;
    const value = Number(cleaned[1]);
    return Number.isFinite(value) ? value : null;
  }

  function parseSqft(input) {
    if (!input) return null;
    const cleaned = input.replace(/,/g, "").match(/(\d+(?:\.\d+)?)\s*(?:sq\.?\s*ft\.?|sf|ft2|sqft)?/i);
    if (!cleaned) return null;
    const value = Number(cleaned[1]);
    return Number.isFinite(value) ? value : null;
  }

  function parseNumericCandidates(text) {
    if (!text) return [];
    const matches = text.match(/\d[\d,]*(?:\.\d+)?/g) || [];
    const nums = matches
      .map((m) => Number(m.replace(/,/g, "")))
      .filter((n) => Number.isFinite(n));
    return nums;
  }

  function findValueByLabel(text, labels) {
    for (const label of labels) {
      const regex = new RegExp(`${label}\\s*[:#-]?\\s*([^\\n|]+)`, "i");
      const match = text.match(regex);
      if (match) return match[1].trim();
    }
    return null;
  }

  function findNumberNearLabel(text, labels) {
    for (const label of labels) {
      const after = new RegExp(`${label}\\s*[:#-]?\\s*(\\$?\\s*\\d[\\d,]*(?:\\.\\d+)?\\s*[mk]?)`, "i");
      const afterMatch = text.match(after);
      if (afterMatch) return afterMatch[1];

      const before = new RegExp(`(\\$?\\s*\\d[\\d,]*(?:\\.\\d+)?\\s*[mk]?)\\s*[:#-]?\\s*${label}`, "i");
      const beforeMatch = text.match(before);
      if (beforeMatch) return beforeMatch[1];
    }
    return null;
  }

  function normalizeLabel(input) {
    return (input || "").toLowerCase().replace(/\s+/g, " ").trim();
  }

  function getRowCells(row) {
    const cells = Array.from(row.querySelectorAll("td, th, [role='gridcell']"));
    if (cells.length > 0) return cells;
    return Array.from(row.children || []);
  }

  function getHeaderMapForRow(row) {
    const map = new Map();
    const table = row.closest("table");
    if (!table) return map;

    const headerRows = Array.from(table.querySelectorAll("tr")).filter((r) => r.querySelector("th, [role='columnheader']"));
    const headerRow = headerRows.length > 0 ? headerRows[headerRows.length - 1] : null;
    if (!headerRow) return map;

    const headerCells = Array.from(headerRow.querySelectorAll("th, [role='columnheader']"));
    headerCells.forEach((cell, idx) => {
      const text = normalizeLabel(cell.textContent || cell.getAttribute("aria-label") || "");
      if (text) map.set(idx, text);
    });
    return map;
  }

  function matchesAnyPattern(text, patterns) {
    return patterns.some((pattern) => new RegExp(pattern, "i").test(text));
  }

  function findValueByColumnLabel(row, includePatterns, excludePatterns, parser) {
    const headerMap = getHeaderMapForRow(row);
    const cells = getRowCells(row);

    for (let i = 0; i < cells.length; i += 1) {
      const cell = cells[i];
      const labels = [
        normalizeLabel(cell.getAttribute("data-title") || ""),
        normalizeLabel(cell.getAttribute("data-label") || ""),
        normalizeLabel(cell.getAttribute("aria-label") || ""),
        normalizeLabel(headerMap.get(i) || "")
      ].filter(Boolean);
      if (labels.length === 0) continue;

      const labelText = labels.join(" | ");
      const matchesInclude = matchesAnyPattern(labelText, includePatterns);
      const matchesExclude = excludePatterns.length > 0 && matchesAnyPattern(labelText, excludePatterns);
      if (!matchesInclude || matchesExclude) continue;

      const parsed = parser(cell.textContent || "");
      if (parsed) {
        return {
          value: parsed,
          source: labels[0] || labelText
        };
      }
    }

    return null;
  }

  function getRow(node) {
    return node.closest(settings.rowSelector) || node.closest("tr") || node.parentElement;
  }

  function looksLikeComparableRow(row) {
    if (!row) return false;

    if (settings.priceSelector && settings.sqftSelector) {
      const priceEl = row.querySelector(settings.priceSelector);
      const sqftEl = row.querySelector(settings.sqftSelector);
      if (priceEl && sqftEl) return true;
    }

    const text = (row.textContent || "").replace(/\s+/g, " ");
    const hasMoney = /\$\s*\d{2,3}(?:,\d{3})+(?:\.\d+)?/.test(text);
    const hasSqftWord = /\b(?:sq\.?\s*ft\.?|square feet|sqft|sf|ft2)\b/i.test(text);
    const hasLikelySqftNumber = /\b\d{3,5}(?:\.\d+)?\b/.test(text);

    return hasMoney && (hasSqftWord || hasLikelySqftNumber);
  }

  function isCheckedControl(node) {
    if (!node) return false;

    if (node instanceof HTMLInputElement) {
      if (node.type === "checkbox") return node.checked;
      return false;
    }

    if (node.getAttribute("role") === "checkbox") {
      return node.getAttribute("aria-checked") === "true";
    }

    if (node.hasAttribute("aria-checked")) {
      return node.getAttribute("aria-checked") === "true";
    }

    return false;
  }

  function getSelectedRowsFromControls() {
    const controls = Array.from(document.querySelectorAll(settings.checkboxSelector));
    const selectedRows = [];

    for (const control of controls) {
      if (!isCheckedControl(control)) continue;
      const row = getRow(control);
      if (row && looksLikeComparableRow(row)) selectedRows.push(row);
    }

    return { controls, selectedRows };
  }

  function getSelectedRowsFallback() {
    const candidates = Array.from(document.querySelectorAll(settings.rowSelector));
    return candidates.filter((row) => {
      const ariaSelected = row.getAttribute("aria-selected") === "true";
      const hasSelectedClass = /\b(selected|is-selected|checked|active)\b/i.test(row.className || "");
      return (ariaSelected || hasSelectedClass) && looksLikeComparableRow(row);
    });
  }

  function extractPrice(row) {
    if (!row) return null;

    if (settings.priceSelector) {
      const el = row.querySelector(settings.priceSelector);
      if (el) {
        const parsed = parseMoney(el.textContent || "");
        if (parsed) return { value: parsed, source: "price selector" };
      }
    }

    const text = row.textContent || "";

    const salePriceByColumn = findValueByColumnLabel(
      row,
      ["^price$", "^sp\\$$", "\\bsp\\$", "sold\\s*price", "sale\\s*price", "closed\\s*price", "close\\s*price", "settled\\s*price"],
      ["^lp\\$$", "\\blp\\$", "list\\s*price", "original\\s*list\\s*price"],
      parseMoney
    );
    if (salePriceByColumn) return salePriceByColumn;

    const explicitSalePrice = findNumberNearLabel(text, [
      "sp\\$",
      "sold\\s*price",
      "sale\\s*price",
      "closed\\s*price",
      "settled\\s*price"
    ]);
    const fromExplicitSale = parseMoney(explicitSalePrice || "");
    if (fromExplicitSale) return { value: fromExplicitSale, source: "sale/closed price label" };

    const plainPrice = findNumberNearLabel(text, [
      "(?<!list\\s)(?<!original\\s)price(?!\\s*/|\\s*per)",
      "close\\s*price"
    ]);
    const plainPriceValue = parseMoney(plainPrice || "");
    if (plainPriceValue) return { value: plainPriceValue, source: "price label" };

    const listPrice = findNumberNearLabel(text, [
      "lp\\$",
      "list\\s*price",
      "original\\s*list\\s*price"
    ]);
    const listPriceValue = parseMoney(listPrice || "");

    const allPrices = text.match(/\$\s*\d{2,3}(?:,\d{3})+(?:\.\d+)?/g) || [];
    if (allPrices.length > 0) {
      const nums = allPrices.map(parseMoney).filter(Boolean);
      if (nums.length > 0) return { value: Math.max(...nums), source: "row currency fallback" };
    }

    const nearPriceMatch = text.match(/\b(?:sold|sale|closed)\s*price\b[^0-9$]{0,20}(\$?\s*\d[\d,]*(?:\.\d+)?\s*[mk]?)/i)
      || text.match(/(\$?\s*\d[\d,]*(?:\.\d+)?\s*[mk]?)\s*[^a-z0-9]{0,4}\b(?:sold|sale|closed)\s*price\b/i);
    if (nearPriceMatch) {
      const parsed = parseMoney(nearPriceMatch[1] || "");
      if (parsed) return { value: parsed, source: "nearby sale label fallback" };
    }

    const numeric = parseNumericCandidates(text);
    const likelyPrices = numeric.filter((n) => n >= 50000 && n <= 50000000);
    if (likelyPrices.length > 0) return { value: Math.max(...likelyPrices), source: "numeric price fallback" };
    if (listPriceValue) return { value: listPriceValue, source: "list price fallback" };

    return null;
  }

  function extractSqft(row) {
    if (!row) return null;

    if (settings.sqftSelector) {
      const el = row.querySelector(settings.sqftSelector);
      if (el) {
        const parsed = parseSqft(el.textContent || "");
        if (parsed) return { value: parsed, source: "sqft selector" };
      }
    }

    const text = row.textContent || "";

    const aboveGradeByColumn = findValueByColumnLabel(
      row,
      [
        "above\\s*grade\\s*finished\\s*area",
        "above\\s*grade\\s*fin(?:ished)?\\s*area",
        "above\\s*grade\\s*sf",
        "finished\\s*above\\s*grade",
        "abv\\s*gr(?:ade)?\\s*fin(?:ished)?\\s*(?:area|sf)?"
      ],
      [],
      parseSqft
    );
    if (aboveGradeByColumn) return aboveGradeByColumn;

    const squareFootageByColumn = findValueByColumnLabel(
      row,
      ["square\\s*footage", "square\\s*feet", "sqft", "living\\s*area", "bldg\\s*sqft", "finished\\s*sqft"],
      [],
      parseSqft
    );
    if (squareFootageByColumn) return squareFootageByColumn;

    const aboveGradeSqft = findNumberNearLabel(text, [
      "above\\s*grade\\s*finished\\s*area",
      "above\\s*grade\\s*fin(?:ished)?\\s*area",
      "above\\s*grade\\s*sf",
      "finished\\s*above\\s*grade",
      "abv\\s*gr(?:ade)?\\s*fin(?:ished)?\\s*(?:area|sf)?"
    ]);
    const fromAboveGrade = parseSqft(aboveGradeSqft || "");
    if (fromAboveGrade) return { value: fromAboveGrade, source: "above grade label" };

    const primarySqft = findNumberNearLabel(text, [
      "square\\s*footage",
      "square\\s*feet",
      "sqft",
      "living\\s*area",
      "bldg\\s*sqft",
      "finished\\s*sqft"
    ]);
    const fromPrimarySqft = parseSqft(primarySqft || "");
    if (fromPrimarySqft) return { value: fromPrimarySqft, source: "square footage label" };

    const sqftMatches = text.match(/\b\d{3,5}(?:\.\d+)?\s*(?:sq\.?\s*ft\.?|sqft|sf|ft2)\b/gi) || [];
    if (sqftMatches.length > 0) {
      const nums = sqftMatches.map(parseSqft).filter(Boolean);
      if (nums.length > 0) return { value: nums[0], source: "sqft text fallback" };
    }

    const nearSqftMatch = text.match(/\b(?:sq\.?\s*ft\.?|square feet|sqft|sf|living area|finished sqft)\b[^0-9]{0,20}(\d[\d,]*(?:\.\d+)?)/i)
      || text.match(/(\d[\d,]*(?:\.\d+)?)\s*[^a-z0-9]{0,4}\b(?:sq\.?\s*ft\.?|square feet|sqft|sf)\b/i);
    if (nearSqftMatch) {
      const parsed = parseSqft(nearSqftMatch[1] || "");
      if (parsed) return { value: parsed, source: "nearby sqft label fallback" };
    }

    const numeric = parseNumericCandidates(text);
    const likelySqft = numeric.filter((n) => n >= 300 && n <= 20000 && !(n >= 1900 && n <= 2099));
    if (likelySqft.length > 0) return { value: likelySqft[0], source: "numeric sqft fallback" };

    return null;
  }

  function formatCurrency(num) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0
    }).format(num);
  }

  function formatPpsf(num) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(num);
  }

  function ensurePanel() {
    let panel = document.getElementById("mls-ppsf-panel");
    if (panel) return panel;

    panel = document.createElement("aside");
    panel.id = "mls-ppsf-panel";
    panel.innerHTML = `
      <div class="mls-ppsf-header">
        <div class="mls-ppsf-title">MLS PPSF</div>
        <button id="mls-ppsf-toggle" type="button">Collapse</button>
      </div>
      <div class="mls-ppsf-grid">
        <div class="label">Selected comps</div><div class="value" id="mls-count">0</div>
        <div class="label">Avg price</div><div class="value" id="mls-avg-price">-</div>
        <div class="label">Avg sqft</div><div class="value" id="mls-avg-sqft">-</div>
        <div class="label">Avg $/sqft</div><div class="value" id="mls-avg-ppsf">-</div>
        <div class="label">Min $/sqft</div><div class="value" id="mls-min-ppsf">-</div>
        <div class="label">Max $/sqft</div><div class="value" id="mls-max-ppsf">-</div>
      </div>
      <div id="mls-ppsf-list"></div>
    `;

    document.body.appendChild(panel);

    const toggle = panel.querySelector("#mls-ppsf-toggle");
    toggle.addEventListener("click", () => {
      const collapsed = panel.classList.toggle("mls-ppsf-collapsed");
      toggle.textContent = collapsed ? "Expand" : "Collapse";
    });

    return panel;
  }

  function computeSelected() {
    const byControl = getSelectedRowsFromControls();
    const rows = byControl.selectedRows.length > 0 ? byControl.selectedRows : getSelectedRowsFallback();
    const uniqueRows = Array.from(new Set(rows));
    const selected = [];
    let skippedNoPrice = 0;
    let skippedNoSqft = 0;

    for (const row of uniqueRows) {
      const price = extractPrice(row);
      const sqft = extractSqft(row);
      if (!price) {
        skippedNoPrice += 1;
        continue;
      }
      if (!sqft || sqft.value <= 0) {
        skippedNoSqft += 1;
        continue;
      }

      selected.push({
        price: price.value,
        sqft: sqft.value,
        ppsf: price.value / sqft.value,
        priceSource: price.source,
        sqftSource: sqft.source,
        rowText: (row.textContent || "").replace(/\s+/g, " ").trim().slice(0, 180)
      });
    }

    return {
      selected,
      controlCount: byControl.controls.length,
      selectedControlRows: byControl.selectedRows.length,
      selectedRowsCount: uniqueRows.length,
      skippedNoPrice,
      skippedNoSqft
    };
  }

  function updatePanel() {
    const panel = ensurePanel();
    const result = computeSelected();
    const comps = result.selected;

    const countEl = panel.querySelector("#mls-count");
    const avgPriceEl = panel.querySelector("#mls-avg-price");
    const avgSqftEl = panel.querySelector("#mls-avg-sqft");
    const avgPpsfEl = panel.querySelector("#mls-avg-ppsf");
    const minPpsfEl = panel.querySelector("#mls-min-ppsf");
    const maxPpsfEl = panel.querySelector("#mls-max-ppsf");
    const listEl = panel.querySelector("#mls-ppsf-list");

    countEl.textContent = String(comps.length);

    if (comps.length === 0) {
      avgPriceEl.textContent = "-";
      avgSqftEl.textContent = "-";
      avgPpsfEl.textContent = "-";
      minPpsfEl.textContent = "-";
      maxPpsfEl.textContent = "-";
      listEl.innerHTML = `<em>Select comparable sales checkboxes to start calculating.</em><div style="margin-top:8px;color:#94a3b8;">Detected controls: ${result.controlCount}, selected rows: ${result.selectedRowsCount}, missing price: ${result.skippedNoPrice}, missing sqft: ${result.skippedNoSqft}</div>`;
      return;
    }

    const totals = comps.reduce(
      (acc, c) => {
        acc.price += c.price;
        acc.sqft += c.sqft;
        acc.ppsf.push(c.ppsf);
        return acc;
      },
      { price: 0, sqft: 0, ppsf: [] }
    );

    const avgPrice = totals.price / comps.length;
    const avgSqft = totals.sqft / comps.length;
    const avgPpsf = totals.ppsf.reduce((a, b) => a + b, 0) / totals.ppsf.length;
    const minPpsf = Math.min(...totals.ppsf);
    const maxPpsf = Math.max(...totals.ppsf);

    avgPriceEl.textContent = formatCurrency(avgPrice);
    avgSqftEl.textContent = Math.round(avgSqft).toLocaleString("en-US");
    avgPpsfEl.textContent = formatPpsf(avgPpsf);
    minPpsfEl.textContent = formatPpsf(minPpsf);
    maxPpsfEl.textContent = formatPpsf(maxPpsf);

    const lines = comps.map((c, idx) => `<li>#${idx + 1}: ${formatCurrency(c.price)} / ${Math.round(c.sqft).toLocaleString("en-US")} sf = <strong>${formatPpsf(c.ppsf)}</strong><br/><span style="color:#94a3b8;">price source: ${c.priceSource}; sqft source: ${c.sqftSource}</span></li>`);
    listEl.innerHTML = `<ul>${lines.join("")}</ul><div style="margin-top:8px;color:#94a3b8;">Detected controls: ${result.controlCount}, selected rows: ${result.selectedRowsCount}, valid comps: ${comps.length}, missing price: ${result.skippedNoPrice}, missing sqft: ${result.skippedNoSqft}</div>`;
  }

  function debounce(fn, wait = 120) {
    let t = null;
    return () => {
      clearTimeout(t);
      t = setTimeout(fn, wait);
    };
  }

  function scheduleUpdate(update) {
    update();
    window.setTimeout(update, 120);
    window.setTimeout(update, 350);
  }

  async function loadSettings() {
    const saved = await chrome.storage.sync.get(STORAGE_KEY);
    settings = { ...DEFAULT_SETTINGS, ...(saved[STORAGE_KEY] || {}) };
  }

  async function init() {
    try {
      await loadSettings();
    } catch (_) {
      settings = { ...DEFAULT_SETTINGS };
    }

    ensurePanel();

    const update = debounce(updatePanel);

    document.addEventListener("change", (event) => {
      const target = event.target;
      if (target instanceof Element) scheduleUpdate(update);
    }, true);

    document.addEventListener("input", (event) => {
      const target = event.target;
      if (target instanceof Element) scheduleUpdate(update);
    }, true);

    document.addEventListener("click", (event) => {
      const target = event.target;
      if (target instanceof Element) scheduleUpdate(update);
    }, true);

    document.addEventListener("keyup", (event) => {
      const target = event.target;
      if (target instanceof Element) scheduleUpdate(update);
    }, true);

    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true
    });

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "sync" && changes[STORAGE_KEY]) {
        settings = { ...DEFAULT_SETTINGS, ...(changes[STORAGE_KEY].newValue || {}) };
        update();
      }
    });

    updatePanel();
  }

  init();
})();
