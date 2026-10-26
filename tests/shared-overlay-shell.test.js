const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const components = fs.readFileSync(path.join(root, "src/ui/components.js"), "utf8");
const styles = fs.readFileSync(path.join(root, "src/data/styles.js"), "utf8");

function expectMatch(source, pattern, label) {
  if (!pattern.test(source)) throw new Error(`Missing ${label}`);
}

expectMatch(components, /function SharedOverlayShell\s*\(/, "shared overlay component");
expectMatch(components, /document\.documentElement\.classList\.add\("md-shared-overlay-open"\)/, "scroll lock");
expectMatch(components, /opener\?\.isConnected && opener\.focus/, "focus return");
expectMatch(components, /className: "md-shared-overlay-header"/, "shared fixed header");
expectMatch(components, /className: "md-shared-overlay-error", role: "alert"/, "shared error slot");
expectMatch(styles, /\.md-shared-overlay-header\s*\{[^}]*position:sticky/s, "sticky header style");
expectMatch(styles, /\.md-shared-overlay-body\s*\{[^}]*overflow-y:auto/s, "scroll container style");
expectMatch(styles, /\.md-shared-overlay-back,.md-shared-overlay-close\s*\{[^}]*width:44px;[^}]*height:44px/s, "44px touch targets");
expectMatch(styles, /var\(--safe-top\)/, "top safe area");
expectMatch(styles, /var\(--safe-bottom\)/, "bottom safe area");

const inventoryStart = components.indexOf("function InventoryOverlayV2(");
const inventoryEnd = components.indexOf("\nfunction InventoryOverlay(", inventoryStart);
const inventory = components.slice(inventoryStart, inventoryEnd);
expectMatch(inventory, /React\.createElement\(SharedOverlayShell/, "Inventory shell migration");
if (/React\.createElement\(StatusBar/.test(inventory)) throw new Error("Inventory must not duplicate the Ver 1.1.14 currency bar");

console.log("shared-overlay-shell: 12 assertions passed");
