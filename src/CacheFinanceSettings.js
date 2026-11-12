/*  *** DEBUG START ***
//  Remove comments for testing in NODE
export { CFSettingsMenu_, CFShowApiKeySettings, CFGetApiKeyStatus, CFSaveApiKeys, CFEnterFredKey };
//  *** DEBUG END ***/

const CF_KEY_PROVIDERS_ = Object.freeze([
    { id: "FINNHUB", label: "Finnhub", property: "FINNHUB_API_KEY" },
    { id: "ALPHA_VANTAGE", label: "Alpha Vantage", property: "ALPHA_VANTAGE_API_KEY" },
    { id: "TWELVE_DATA", label: "Twelve Data", property: "TWELVE_DATA_API_KEY" },
    { id: "COINMARKET", label: "CoinMarketCap", property: "COINMARKET_API_KEY" },
    { id: "FRED", label: "FRED", property: "FRED_API_KEY" }
]);

/** Add this menu from the spreadsheet's onOpen function. */
function CFSettingsMenu_() {
    SpreadsheetApp.getUi().createMenu("CacheFinance")
        .addItem("API keys…", "CFShowApiKeySettings")
        .addItem("Enter FRED key…", "CFEnterFredKey").addToUi();
}

/** Native Google prompt works without the embedded HTML sidebar. The user submits it. */
function CFEnterFredKey() {
    const ui = SpreadsheetApp.getUi();
    try {
        const reply = ui.prompt("Save FRED API key", "Paste your existing FRED key. Google's standard prompt shows the text you type. The key is saved in this private script's properties, outside worksheet cells. Blank keeps the existing key.", ui.ButtonSet.OK_CANCEL);
        if (reply.getSelectedButton() !== ui.Button.OK) return { ok: false, cancelled: true };
        const value = reply.getResponseText().trim();
        if (!value) { ui.alert("No key changed."); return { ok: true, changed: false }; }
        if (!/^[a-z0-9]{32}$/.test(value)) { ui.alert("FRED keys contain 32 lowercase letters and digits. Check the key and try again."); return { ok: false, error: "Invalid FRED key format." }; }
        const saved = CFSaveApiKeys({ updates: [{ provider: "FRED", action: "replace", value }] });
        ui.alert(saved.ok ? "FRED key saved. Choose Stock analysis → Refresh selected ticker to load the economic series." : "Unable to save the FRED key. Try again.");
        return { ok: saved.ok };
    } catch (_error) { ui.alert("Unable to open or save FRED key settings. Try again."); return { ok: false, error: "Unable to save FRED key settings." }; }
}

/** Open a sidebar. Saved keys are never included in its HTML. */
function CFShowApiKeySettings() {
    try {
        const output = HtmlService.createHtmlOutput(CF_API_KEYS_HTML_).setTitle("CacheFinance API keys");
        SpreadsheetApp.getUi().showSidebar(output);
    } catch (_error) {
        SpreadsheetApp.getUi().alert("Unable to open API key settings. Reload the spreadsheet and try again.");
    }
}

/** Return labels and presence flags only. Never return a saved key or key fragment. */
function CFGetApiKeyStatus() {
    try {
        return CFKeyStatus_(PropertiesService.getScriptProperties());
    } catch (_error) {
        return { ok: false, error: "Unable to load API key settings. Try again." };
    }
}

function CFKeyStatus_(properties) {
    return {
        ok: true,
        providers: CF_KEY_PROVIDERS_.map(provider => ({
            id: provider.id,
            label: provider.label,
            configured: Boolean(properties.getProperty(provider.property))
        }))
    };
}

/** Validate all updates before changing any Script Properties. */
function CFValidateKeyUpdates_(request) {
    if (!request || typeof request !== "object" || Array.isArray(request)
        || Object.keys(request).length !== 1 || !Object.prototype.hasOwnProperty.call(request, "updates")
        || !Array.isArray(request.updates) || request.updates.length > CF_KEY_PROVIDERS_.length) {
        return null;
    }
    const seen = new Set();
    const updates = [];
    for (const update of request.updates) {
        if (!update || typeof update !== "object" || Array.isArray(update)) return null;
        const provider = CF_KEY_PROVIDERS_.find(item => item.id === update.provider);
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
function CFSaveApiKeys(request) {
    const failure = { ok: false, error: "Unable to save API keys. Check the entries and try again." };
    let lock;
    let acquired = false;
    try {
        const updates = CFValidateKeyUpdates_(request);
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
        return CFKeyStatus_(properties);
    } catch (_error) {
        return failure;
    } finally {
        if (acquired) {
            // Do not let a service exception disclose an input or saved key.
            try { lock.releaseLock(); } catch (_error) { /* Apps Script also releases locks on exit. */ }
        }
    }
}

const CF_API_KEYS_HTML_ = `<!DOCTYPE html>
<html><head><base target="_top"><meta charset="utf-8">
<style>
body{font:14px Arial,sans-serif;color:#202124;padding:12px;line-height:1.4}
h2{font-size:18px;margin:0 0 12px}p{margin:10px 0}.provider{border-top:1px solid #dadce0;padding:12px 0}
.heading{display:flex;justify-content:space-between;gap:8px}.status{font-size:12px;color:#5f6368}
input[type=password]{box-sizing:border-box;width:100%;padding:8px;margin:7px 0}
.remove{font-size:12px;display:block}button{padding:8px 12px;margin:8px 8px 0 0;cursor:pointer}
#message{min-height:36px}button:disabled{cursor:default}#privacy{font-size:12px;color:#5f6368}
</style></head><body>
<h2>API keys</h2>
<p>Enter a new key to save or replace it. Leave a field blank to keep its saved key. Select Remove to delete a saved key.</p>
<form id="settings"><div id="providers"></div>
<button id="save" type="submit" disabled>Save keys</button><button id="reload" type="button">Reload status</button></form>
<p id="message" role="status" aria-live="polite">Loading settings…</p>
<p id="privacy">Keys stay in this Apps Script project's Script Properties. They are not stored in worksheet cells or shown here after saving. People who can edit this script can access its keys. Use your own keys in your private copy of the spreadsheet. This form does not test provider connections.</p>
<script>
(function () {
  'use strict';
  var ids = ['FINNHUB','ALPHA_VANTAGE','TWELVE_DATA','COINMARKET','FRED'];
  var labels = ['Finnhub','Alpha Vantage','Twelve Data','CoinMarketCap','FRED'];
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
    var input = document.createElement('input'); input.id = 'key-' + id; input.type = 'password'; input.autocomplete = 'new-password'; input.maxLength = 2048; input.placeholder = 'New key (leave blank to keep)';
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
    }).CFGetApiKeyStatus();
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
    }).CFSaveApiKeys({updates:updates});
  });
  reload.addEventListener('click', load);
  load();
})();
</script></body></html>`;
