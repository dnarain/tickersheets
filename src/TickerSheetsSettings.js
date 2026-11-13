/*  *** DEBUG START ***
//  Remove comments for testing in NODE
export { TickerSheetsMenu, TickerSheetsShowApiKeys, TickerSheetsGetApiKeyStatus, TickerSheetsSaveApiKeys };
//  *** DEBUG END ***/

const TICKERSHEETS_KEY_PROVIDERS_ = Object.freeze([
    { id: "FINNHUB", label: "Finnhub", property: "FINNHUB_API_KEY" },
    { id: "ALPHA_VANTAGE", label: "Alpha Vantage", property: "ALPHA_VANTAGE_API_KEY" },
    { id: "TWELVE_DATA", label: "Twelve Data", property: "TWELVE_DATA_API_KEY" },
    { id: "COINMARKET", label: "CoinMarketCap", property: "COINMARKET_API_KEY" },
    { id: "FRED", label: "FRED", property: "FRED_API_KEY" }
]);

/** Add this menu from the spreadsheet's onOpen function. */
function TickerSheetsMenu() {
    SpreadsheetApp.getUi().createMenu("TickerSheets")
        .addItem("API keys…", "TickerSheetsShowApiKeys")
        .addItem("Refresh data", "TickerSheetsRefreshData")
        .addToUi();
}

/** Open a sidebar. Saved keys are never included in its HTML. */
function TickerSheetsShowApiKeys() {
    try {
        const output = HtmlService.createHtmlOutput(TICKERSHEETS_API_KEYS_HTML_).setTitle("TickerSheets: API keys");
        SpreadsheetApp.getUi().showSidebar(output);
    } catch (_error) {
        SpreadsheetApp.getUi().alert("Unable to open API key settings. Reload the spreadsheet and try again.");
    }
}

/** Return labels and presence flags only. Never return a saved key or key fragment. */
function TickerSheetsGetApiKeyStatus() {
    try {
        return TickerSheetsKeyStatus_(PropertiesService.getScriptProperties());
    } catch (_error) {
        return { ok: false, error: "Unable to load API key settings. Try again." };
    }
}

function TickerSheetsKeyStatus_(properties) {
    return {
        ok: true,
        providers: TICKERSHEETS_KEY_PROVIDERS_.map(provider => ({
            id: provider.id,
            label: provider.label,
            configured: Boolean(properties.getProperty(provider.property))
        }))
    };
}

/** Validate all updates before changing any Script Properties. */
function TickerSheetsValidateKeyUpdates_(request) {
    if (!request || typeof request !== "object" || Array.isArray(request)
        || Object.keys(request).length !== 1 || !Object.prototype.hasOwnProperty.call(request, "updates")
        || !Array.isArray(request.updates) || request.updates.length > TICKERSHEETS_KEY_PROVIDERS_.length) {
        return null;
    }
    const seen = new Set();
    const updates = [];
    for (const update of request.updates) {
        if (!update || typeof update !== "object" || Array.isArray(update)) return null;
        const provider = TICKERSHEETS_KEY_PROVIDERS_.find(item => item.id === update.provider);
        if (!provider || seen.has(provider.id)) return null;
        seen.add(provider.id);
        const fields = Object.keys(update).sort().join(",");
        if (update.action === "remove" && fields === "action,provider") {
            updates.push({ property: provider.property, action: "remove" });
        } else if (update.action === "replace" && fields === "action,provider,value"
            && typeof update.value === "string" && update.value.length <= 2048
            && !/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/.test(update.value)) {
            const value = update.value.trim();
            if (/\s/.test(value)) return null;
            // A blank input keeps the saved key. Only "remove" deletes one.
            if (value) updates.push({ property: provider.property, action: "replace", value });
        } else {
            return null;
        }
    }
    return updates;
}

/** Save only the supported API key properties. */
function TickerSheetsSaveApiKeys(request) {
    const failure = { ok: false, error: "Unable to save API keys. Check the entries and try again." };
    let lock;
    let acquired = false;
    try {
        const updates = TickerSheetsValidateKeyUpdates_(request);
        if (updates === null) return failure;
        lock = LockService.getScriptLock();
        acquired = lock.tryLock(5000);
        if (!acquired) return failure;
        const properties = PropertiesService.getScriptProperties();
        const replacements = {};
        for (const update of updates) {
            if (update.action === "replace") replacements[update.property] = update.value;
        }
        if (Object.keys(replacements).length) properties.setProperties(replacements, false);
        for (const update of updates) {
            if (update.action === "remove") properties.deleteProperty(update.property);
        }
        return TickerSheetsKeyStatus_(properties);
    } catch (_error) {
        return failure;
    } finally {
        if (acquired) {
            // Do not let a service exception disclose an input or saved key.
            try { lock.releaseLock(); } catch (_error) { /* Apps Script also releases locks on exit. */ }
        }
    }
}

const TICKERSHEETS_API_KEYS_HTML_ = `<!DOCTYPE html>
<html><head><base target="_top"><meta charset="utf-8">
<style>
body{font:14px Arial,sans-serif;color:#202124;padding:12px;line-height:1.4}
p{margin:10px 0}.provider{border-top:1px solid #dadce0;padding:8px 0}
.heading{display:flex;justify-content:space-between;gap:8px}.status{font-size:12px;color:#5f6368}
input[type=password]{box-sizing:border-box;width:100%;padding:6px;margin:4px 0}
input[type=password]::placeholder{color:#9aa0a6;opacity:1}
.remove{font-size:12px;display:block}button{padding:8px 12px;margin:8px 8px 0 0;cursor:pointer}
#message{min-height:36px}button:disabled{cursor:default}#privacy{font-size:12px;color:#5f6368}
</style></head><body>
<p>Leave a field blank to keep its saved key. Select Remove to delete it.</p>
<form id="settings"><div id="providers"></div>
<button id="save" type="submit" disabled>Save keys</button><button id="reload" type="button">Reload status</button></form>
<p id="message" role="status" aria-live="polite">Loading settings…</p>
<p id="privacy">Keys stay in this Apps Script project's Script Properties. They are not stored in worksheet cells or shown here after saving. People who can edit this script can access its keys. Use your own keys in your private copy of the spreadsheet. This form does not test provider connections.</p>
<script>
(function () {
  'use strict';
  var ids = ['FINNHUB', 'ALPHA_VANTAGE', 'TWELVE_DATA', 'COINMARKET', 'FRED'];
  var labels = ['Finnhub', 'Alpha Vantage', 'Twelve Data', 'CoinMarketCap', 'FRED'];
  var root = document.getElementById('providers');
  var form = document.getElementById('settings');
  var message = document.getElementById('message');
  var save = document.getElementById('save');
  var reload = document.getElementById('reload');
  var ready = false;
  var busy = false;
  ids.forEach(function (id, index) {
    var row = document.createElement('div'); row.className = 'provider';
    var heading = document.createElement('div'); heading.className = 'heading';
    var label = document.createElement('label'); label.htmlFor = 'key-' + id; label.textContent = labels[index];
    var status = document.createElement('span'); status.id = 'status-' + id; status.className = 'status'; status.textContent = 'Loading…';
    heading.appendChild(label); heading.appendChild(status); row.appendChild(heading);
    var input = document.createElement('input'); input.id = 'key-' + id; input.type = 'password'; input.autocomplete = 'new-password'; input.maxLength = 2048; input.placeholder = 'Enter API key';
    row.appendChild(input);
    var removalLabel = document.createElement('label'); removalLabel.className = 'remove';
    var remove = document.createElement('input'); remove.type = 'checkbox'; remove.id = 'remove-' + id;
    removalLabel.appendChild(remove); removalLabel.appendChild(document.createTextNode(' Remove saved key'));
    row.appendChild(removalLabel); root.appendChild(row);
  });
  function pending(value) {
    busy = value;
    ids.forEach(function (id) {
      document.getElementById('key-' + id).disabled = value || !ready;
      document.getElementById('remove-' + id).disabled = value || !ready;
    });
    save.disabled = value || !ready; reload.disabled = value;
  }
  function render(result) {
    if (!result || result.ok !== true || !Array.isArray(result.providers) || result.providers.length !== ids.length) return false;
    var valid = ids.every(function (id) {
      return result.providers.filter(function (p) { return p && p.id === id && typeof p.configured === 'boolean'; }).length === 1;
    });
    if (!valid) return false;
    result.providers.forEach(function (provider) {
      document.getElementById('status-' + provider.id).textContent = provider.configured ? 'Saved' : 'Not set';
      document.getElementById('key-' + provider.id).placeholder = provider.configured ? '•••••••• — saved key' : 'Enter API key';
    });
    ready = true;
    return true;
  }
  function load() {
    if (busy) return;
    pending(true); message.textContent = 'Loading settings…';
    google.script.run.withSuccessHandler(function (result) {
      message.textContent = render(result) ? 'Enter only the keys you want to change.' : 'Unable to load settings. Try Reload status.';
      pending(false);
    }).withFailureHandler(function () {
      message.textContent = 'Unable to load settings. Try Reload status.'; pending(false);
    }).TickerSheetsGetApiKeyStatus();
  }
  form.addEventListener('submit', function (event) {
    event.preventDefault();
    if (busy || !ready) return;
    var updates = [];
    for (var i = 0; i < ids.length; i++) {
      var id = ids[i]; var value = document.getElementById('key-' + id).value;
      var remove = document.getElementById('remove-' + id).checked;
      if (remove && value.trim()) { message.textContent = 'Enter a new key or select Remove for each provider.'; return; }
      if (remove) updates.push({provider:id,action:'remove'});
      else if (value.trim()) updates.push({provider:id,action:'replace',value:value});
    }
    pending(true); message.textContent = 'Saving keys…';
    google.script.run.withSuccessHandler(function (result) {
      if (render(result)) {
        ids.forEach(function (id) { document.getElementById('key-' + id).value = ''; document.getElementById('remove-' + id).checked = false; });
        message.textContent = 'Keys saved. Provider connections were not tested.';
      } else { message.textContent = 'Unable to save keys. Check the entries and try again.'; }
      pending(false);
    }).withFailureHandler(function () {
      message.textContent = 'Unable to save keys. Try again.'; pending(false);
    }).TickerSheetsSaveApiKeys({updates:updates});
  });
  reload.addEventListener('click', load);
  load();
})();
</script></body></html>`;
