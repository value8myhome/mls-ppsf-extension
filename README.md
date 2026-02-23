# MLS Price Per Sq Ft Chrome Extension

This extension adds a live calculator panel to MLS pages and updates stats as you check or uncheck comparable sales.

## What it calculates

- Selected comp count
- Average sale price
- Average square footage
- Average, min, and max price per square foot
- Per-comp `price / sqft` lines

## Install (developer mode)

1. Open Chrome and go to `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this folder: `mls-ppsf-extension`.

## Use

1. Open your MLS comparables page.
2. Check comparable sale rows.
3. Watch the floating **MLS PPSF** panel update in real time.

## If your MLS markup is different

1. Open extension details and click **Extension options**.
2. Configure selectors:
   - `Checkbox selector`
   - `Row selector`
   - Optional `Price selector`
   - Optional `Sqft selector`
3. Save and return to your MLS tab.

## Quick troubleshooting

- Reload the extension in `brave://extensions` after updates.
- The panel now shows `Detected controls` and `selected rows` at the bottom.
- If those numbers stay `0`, your MLS uses custom markup: set a tighter `Checkbox selector` and `Row selector` in options.

## Notes

- Because MLS systems vary, automatic detection uses best-effort parsing by labels and currency/sqft patterns.
- For best accuracy, set explicit price and sqft selectors in options for your MLS.
- The panel is resizable from the corner and defaults to a taller size for reviewing more selected comps.
