import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import vm from "node:vm";
import { TickerSheetsMenu, TickerSheetsShowApiKeys, TickerSheetsGetApiKeyStatus, TickerSheetsSaveApiKeys } from "../src/TickerSheetsSettings.js";

const ids = ["FINNHUB", "ALPHA_VANTAGE", "TWELVE_DATA", "COINMARKET", "FRED"];
const labels = ["Finnhub", "Alpha Vantage", "Twelve Data", "CoinMarketCap", "FRED"];
const propertyNames = ["FINNHUB_API_KEY", "ALPHA_VANTAGE_API_KEY", "TWELVE_DATA_API_KEY", "COINMARKET_API_KEY", "FRED_API_KEY"];
const expectedStatus = (configured = false) => ({ ok: true, providers: ids.map((id, index) => ({
    id, label: labels[index], configured: Array.isArray(configured) ? configured.includes(id) : configured
})) });
let values, properties, lock, menu, ui, output, html;
beforeEach(() => {
    values = new Map();
    properties = { getProperty: vi.fn(key => values.get(key) ?? null),
        setProperties: vi.fn(data => Object.entries(data).forEach(([key, value]) => values.set(key, value))),
        deleteProperty: vi.fn(key => values.delete(key)) };
    lock = { tryLock: vi.fn(() => true), releaseLock: vi.fn() };
    menu = { addItem: vi.fn(() => menu), addToUi: vi.fn() };
    ui = { createMenu: vi.fn(() => menu), showSidebar: vi.fn(), alert: vi.fn(), prompt: vi.fn() };
    output = { setTitle: vi.fn(() => output) };
    vi.stubGlobal("PropertiesService", { getScriptProperties: vi.fn(() => properties) });
    vi.stubGlobal("LockService", { getScriptLock: vi.fn(() => lock) });
    vi.stubGlobal("SpreadsheetApp", { getUi: vi.fn(() => ui) });
    vi.stubGlobal("HtmlService", { createHtmlOutput: vi.fn(value => { html = value; return output; }) });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("private API key settings", () => {
    it("returns five presence flags and never reads unrelated saved properties", () => {
        propertyNames.forEach((property, index) => values.set(property, `secret-provider-${index}`));
        values.set("UNRELATED", "unrelated-secret");
        expect(TickerSheetsGetApiKeyStatus()).toEqual(expectedStatus(true));
        expect(properties.getProperty.mock.calls).toEqual(propertyNames.map(property => [property]));
        expect(JSON.stringify(TickerSheetsGetApiKeyStatus())).not.toContain("secret");
    });
    it("reports missing and empty keys as not set", () => {
        expect(TickerSheetsGetApiKeyStatus()).toEqual(expectedStatus());
        propertyNames.forEach(property => values.set(property, ""));
        expect(TickerSheetsGetApiKeyStatus()).toEqual(expectedStatus());
    });
    it("returns a fixed status error", () => {
        properties.getProperty.mockImplementation(() => { throw new Error("secret-exception"); });
        expect(TickerSheetsGetApiKeyStatus()).toEqual({ ok: false, error: "Unable to load API key settings. Try again." });
    });
    it.each([{ updates: [] }, { updates: [{ provider: "FRED", action: "replace", value: "  " }] }])("preserves existing keys for blank updates (%#)", request => {
        values.set("FRED_API_KEY", "saved"); values.set("UNRELATED", "keep");
        expect(TickerSheetsSaveApiKeys(request)).toEqual(expectedStatus(["FRED"]));
        expect([...values]).toEqual([["FRED_API_KEY", "saved"], ["UNRELATED", "keep"]]);
        expect(properties.setProperties).not.toHaveBeenCalled(); expect(properties.deleteProperty).not.toHaveBeenCalled();
    });
    it("trims a replacement and preserves unrelated properties", () => {
        values.set("FINNHUB_API_KEY", "keep-finnhub"); values.set("UNRELATED", "keep");
        expect(TickerSheetsSaveApiKeys({ updates: [{ provider: "FRED", action: "replace", value: "  new-key  " }] })).toEqual(expectedStatus(["FINNHUB", "FRED"]));
        expect(properties.setProperties).toHaveBeenCalledWith({ FRED_API_KEY: "new-key" }, false);
        expect(values.get("FINNHUB_API_KEY")).toBe("keep-finnhub"); expect(values.get("UNRELATED")).toBe("keep");
        expect(lock.releaseLock).toHaveBeenCalledOnce();
    });
    it("removes only FRED after an explicit removal", () => {
        values.set("FRED_API_KEY", "old"); values.set("FINNHUB_API_KEY", "keep");
        expect(TickerSheetsSaveApiKeys({ updates: [{ provider: "FRED", action: "remove" }] })).toEqual(expectedStatus(["FINNHUB"]));
        expect(values.has("FRED_API_KEY")).toBe(false); expect(values.get("FINNHUB_API_KEY")).toBe("keep");
    });
    it("saves all five providers in one update without replacing unrelated properties", () => {
        values.set("UNRELATED", "keep");
        const updates = ids.map((provider, index) => ({ provider, action: "replace", value: `synthetic-provider-${index}` }));
        const result = TickerSheetsSaveApiKeys({ updates });
        expect(result).toEqual(expectedStatus(true));
        expect(properties.setProperties).toHaveBeenCalledWith(Object.fromEntries(propertyNames.map((property, index) => [property, `synthetic-provider-${index}`])), false);
        expect(values.get("UNRELATED")).toBe("keep");
        expect(JSON.stringify(result)).not.toContain("synthetic-");
    });
    it.each(ids)("keeps blank fields and explicitly removes only %s", provider => {
        propertyNames.forEach((property, index) => values.set(property, `saved-provider-${index}`));
        const updates = ids.map(id => id === provider ? { provider: id, action: "remove" } : { provider: id, action: "replace", value: "  " });
        expect(TickerSheetsSaveApiKeys({ updates })).toEqual(expectedStatus(ids.filter(id => id !== provider)));
        expect(properties.setProperties).not.toHaveBeenCalled();
        expect(properties.deleteProperty).toHaveBeenCalledExactlyOnceWith(propertyNames[ids.indexOf(provider)]);
        propertyNames.forEach((property, index) => expect(values.get(property)).toBe(ids[index] === provider ? undefined : `saved-provider-${index}`));
    });
    it("validates the complete batch before saving any provider", () => {
        expect(TickerSheetsSaveApiKeys({ updates: [
            { provider: "FINNHUB", action: "replace", value: "synthetic-new-key" },
            { provider: "TWELVE_DATA", action: "replace", value: "invalid key with spaces" }
        ] }).ok).toBe(false);
        expect(properties.setProperties).not.toHaveBeenCalled();
        expect(PropertiesService.getScriptProperties).not.toHaveBeenCalled();
    });
    it.each([
        undefined, null, [], {}, { updates: null }, { updates: {} }, { updates: [], extra: true },
        { updates: [null] }, { updates: [[]] }, { updates: ["secret"] },
        { updates: [{ provider: "UNKNOWN", action: "remove" }] },
        { updates: [{ provider: "__proto__", action: "remove" }] },
        { updates: [{ provider: "FRED", action: "unknown" }] },
        { updates: [{ provider: "FRED", action: "remove", value: "ambiguous" }] },
        { updates: [{ provider: "FRED", action: "replace" }] },
        { updates: [{ provider: "FRED", action: "replace", value: null }] },
        { updates: [{ provider: "FRED", action: "replace", value: 123 }] },
        { updates: [{ provider: "FRED", action: "replace", value: "x", extra: true }] },
        ...["x".repeat(2049), "secret\nvalue", "secret\u0000value", "secret\u007fvalue", "secret\u2028value", "secret value"].map(value => ({ updates: [{ provider: "FRED", action: "replace", value }] })),
        { updates: [{ provider: "FRED", action: "remove" }, { provider: "FRED", action: "remove" }] }
    ])("rejects malformed or unsupported updates before reading properties (%#)", request => {
        expect(TickerSheetsSaveApiKeys(request)).toEqual({ ok: false, error: "Unable to save API keys. Check the entries and try again." });
        expect(LockService.getScriptLock).not.toHaveBeenCalled(); expect(PropertiesService.getScriptProperties).not.toHaveBeenCalled();
    });
    it("does not release a lock it cannot acquire", () => {
        lock.tryLock.mockReturnValue(false);
        expect(TickerSheetsSaveApiKeys({ updates: [] }).ok).toBe(false);
        expect(lock.releaseLock).not.toHaveBeenCalled(); expect(properties.setProperties).not.toHaveBeenCalled();
    });
    it.each(["getScriptLock", "tryLock", "setProperties", "deleteProperty", "getProperty"])("does not expose %s exceptions", method => {
        const target = method === "getScriptLock" ? LockService : method === "tryLock" ? lock : properties;
        target[method].mockImplementation(() => { throw new Error("secret-service-exception"); });
        const updates = [{ provider: "FRED", action: method === "deleteProperty" ? "remove" : "replace", ...(method === "deleteProperty" ? {} : { value: "synthetic-key" }) }];
        expect(TickerSheetsSaveApiKeys({ updates })).toEqual({ ok: false, error: "Unable to save API keys. Check the entries and try again." });
        if (!["getScriptLock", "tryLock"].includes(method)) expect(lock.releaseLock).toHaveBeenCalledOnce();
    });
    it("does not disclose a lock release exception", () => {
        lock.releaseLock.mockImplementation(() => { throw new Error("secret-release-exception"); });
        expect(TickerSheetsSaveApiKeys({ updates: [] })).toEqual(expectedStatus());
    });
});

function sidebar() {
    TickerSheetsShowApiKeys();
    const nodes = new Map();
    class Node {
        constructor(tag) { this.tagName = tag; this.children = []; this.listeners = {}; this.value = ""; this.checked = false; this.disabled = false; this.textContent = ""; }
        set id(value) { this._id = value; nodes.set(value, this); }
        get id() { return this._id; }
        appendChild(node) { this.children.push(node); return node; }
        addEventListener(event, handler) { this.listeners[event] = handler; }
        trigger(event) { this.listeners[event]({ preventDefault() {} }); }
    }
    ["providers", "settings", "message", "save", "reload"].forEach(id => { const node = new Node("div"); node.id = id; });
    const calls = [];
    const runner = {
        withSuccessHandler(callback) { this.success = callback; return this; },
        withFailureHandler(callback) { this.failure = callback; return this; },
        TickerSheetsGetApiKeyStatus() { calls.push({ type: "load", success: this.success, failure: this.failure }); },
        TickerSheetsSaveApiKeys(request) { calls.push({ type: "save", request, success: this.success, failure: this.failure }); }
    };
    const document = {
        getElementById: id => nodes.get(id),
        createElement: tag => new Node(tag),
        createTextNode: text => ({ textContent: text })
    };
    const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
    vm.runInNewContext(script, { document, google: { script: { run: runner } } });
    return { nodes, calls, get: id => nodes.get(id) };
}

describe("API key menu and sidebar", () => {
    it("adds API keys and Refresh data to the TickerSheets menu", () => {
        TickerSheetsMenu();
        expect(ui.createMenu).toHaveBeenCalledWith("TickerSheets");
        expect(menu.addItem.mock.calls).toEqual([["API keys…", "TickerSheetsShowApiKeys"], ["Refresh data", "TickerSheetsRefreshData"]]);
        expect(menu.addToUi).toHaveBeenCalledOnce();
    });

    it("opens static HTML without reading saved properties", () => {
        values.set("FRED_API_KEY", "never-in-html</script>");
        TickerSheetsShowApiKeys();
        expect(ui.showSidebar).toHaveBeenCalledWith(output);
        expect(output.setTitle).toHaveBeenCalledWith("TickerSheets: API keys");
        expect(properties.getProperty).not.toHaveBeenCalled();
        expect(html).not.toContain("never-in-html");
        expect(html).toContain("People who can edit this script can access its keys.");
        expect(html).toContain("your private copy");
        expect(html).toContain("input[type=password]::placeholder{color:#9aa0a6;opacity:1}");
    });

    it("shows a fixed error if the sidebar cannot open", () => {
        HtmlService.createHtmlOutput.mockImplementation(() => { throw new Error("private-error"); });
        TickerSheetsShowApiKeys();
        expect(ui.alert).toHaveBeenCalledWith("Unable to open API key settings. Reload the spreadsheet and try again.");
    });

    it("loads presence flags with empty password fields and disables controls while loading", () => {
        const view = sidebar();
        expect(view.calls.map(call => call.type)).toEqual(["load"]);
        ids.forEach(id => {
            expect(view.get(`key-${id}`).type).toBe("password");
            expect(view.get(`key-${id}`).value).toBe("");
            expect(view.get(`key-${id}`).disabled).toBe(true);
        });
        view.calls[0].success(expectedStatus(true));
        ids.forEach(id => {
            expect(view.get(`status-${id}`).textContent).toBe("Saved");
            expect(view.get(`key-${id}`).value).toBe("");
            expect(view.get(`key-${id}`).placeholder).toBe("•••••••• — saved key");
            expect(view.get(`key-${id}`).disabled).toBe(false);
        });
    });

    it("shows a saved-key placeholder only for configured providers without filling any input", () => {
        const view = sidebar();
        view.calls[0].success(expectedStatus(["FINNHUB", "FRED"]));
        ids.forEach(id => {
            expect(view.get(`key-${id}`).placeholder).toBe(["FINNHUB", "FRED"].includes(id) ? "•••••••• — saved key" : "Enter API key");
            expect(view.get(`key-${id}`).value).toBe("");
        });
    });

    it("saves FRED from its password field while preserving unrelated properties", () => {
        propertyNames.forEach((key, index) => values.set(key, `saved-synthetic-${index}`));
        values.set("FINNHUB_API_KEY", "unrelated-saved-key");
        const view = sidebar(); view.calls[0].success(TickerSheetsGetApiKeyStatus());
        expect(view.get("key-FRED").type).toBe("password"); expect(view.get("key-FRED").value).toBe("");
        view.get("key-FRED").value = "synthetic-fred-replacement"; view.get("settings").trigger("submit");
        const call = view.calls[1];
        expect(JSON.parse(JSON.stringify(call.request))).toEqual({ updates: [{ provider: "FRED", action: "replace", value: "synthetic-fred-replacement" }] });
        const result = TickerSheetsSaveApiKeys(call.request); call.success(result);
        expect(result).toEqual(expectedStatus(true)); expect(values.get("FRED_API_KEY")).toBe("synthetic-fred-replacement");
        expect(values.get("FINNHUB_API_KEY")).toBe("unrelated-saved-key");
        expect(properties.setProperties).toHaveBeenCalledWith({ FRED_API_KEY: "synthetic-fred-replacement" }, false); expect(properties.deleteProperty).not.toHaveBeenCalled();
        expect(view.get("key-FRED").value).toBe(""); expect(view.get("status-FRED").textContent).toBe("Saved");
        expect(JSON.stringify(result)).not.toContain("synthetic-"); expect(ui.prompt).not.toHaveBeenCalled();
    });

    it("keeps stored keys when saved placeholders are visible and all fields are blank", () => {
        propertyNames.forEach((property, index) => values.set(property, `saved-synthetic-${index}`));
        const view = sidebar();
        view.calls[0].success(TickerSheetsGetApiKeyStatus());
        view.get("settings").trigger("submit");
        const call = view.calls[1];
        expect(JSON.parse(JSON.stringify(call.request))).toEqual({ updates: [] });
        call.success(TickerSheetsSaveApiKeys(call.request));
        propertyNames.forEach((property, index) => expect(values.get(property)).toBe(`saved-synthetic-${index}`));
        expect(properties.setProperties).not.toHaveBeenCalled();
        expect(properties.deleteProperty).not.toHaveBeenCalled();
        ids.forEach(id => expect(view.get(`key-${id}`).value).toBe(""));
    });

    it("submits all five provider fields through one form and clears them after saving", () => {
        const view = sidebar(); view.calls[0].success(expectedStatus());
        ids.forEach((id, index) => { view.get(`key-${id}`).value = `synthetic-provider-${index}`; });
        view.get("settings").trigger("submit");
        const call = view.calls[1];
        expect(JSON.parse(JSON.stringify(call.request))).toEqual({ updates: ids.map((provider, index) => ({ provider, action: "replace", value: `synthetic-provider-${index}` })) });
        call.success(TickerSheetsSaveApiKeys(call.request));
        ids.forEach(id => {
            expect(view.get(`key-${id}`).value).toBe("");
            expect(view.get(`status-${id}`).textContent).toBe("Saved");
            expect(view.get(`key-${id}`).placeholder).toBe("•••••••• — saved key");
        });
    });

    it("clears the saved-key placeholder after explicit removal", () => {
        values.set("FRED_API_KEY", "saved-synthetic-fred");
        const view = sidebar(); view.calls[0].success(TickerSheetsGetApiKeyStatus());
        expect(view.get("key-FRED").placeholder).toBe("•••••••• — saved key");
        view.get("remove-FRED").checked = true; view.get("settings").trigger("submit");
        const call = view.calls[1]; call.success(TickerSheetsSaveApiKeys(call.request));
        expect(values.has("FRED_API_KEY")).toBe(false);
        expect(view.get("status-FRED").textContent).toBe("Not set");
        expect(view.get("key-FRED").placeholder).toBe("Enter API key");
        expect(view.get("key-FRED").value).toBe("");
        expect(view.get("remove-FRED").checked).toBe(false);
    });

    it("updates saved-key placeholders when status reloads", () => {
        const view = sidebar(); view.calls[0].success(expectedStatus(["FINNHUB"]));
        view.get("reload").trigger("click");
        view.calls[1].success(expectedStatus(["FRED"]));
        expect(view.get("key-FINNHUB").placeholder).toBe("Enter API key");
        expect(view.get("key-FRED").placeholder).toBe("•••••••• — saved key");
        ids.forEach(id => expect(view.get(`key-${id}`).value).toBe(""));
    });

    it("rejects remove and replacement together without calling the server", () => {
        const view = sidebar();
        view.calls[0].success(expectedStatus(true));
        view.get("key-FRED").value = "synthetic-key";
        view.get("remove-FRED").checked = true;
        view.get("settings").trigger("submit");
        expect(view.calls).toHaveLength(1);
        expect(view.get("message").textContent).toContain("Enter a new key or select Remove");
    });

    it.each(["failure", "result"])("keeps entries and displays a fixed message after a save %s", failureType => {
        const view = sidebar();
        view.calls[0].success(expectedStatus());
        view.get("key-FRED").value = "synthetic-key";
        view.get("settings").trigger("submit");
        if (failureType === "failure") view.calls[1].failure(new Error("secret-server-message"));
        else view.calls[1].success({ ok: false, error: "secret-server-message" });
        expect(view.get("message").textContent).toContain("Unable to save keys.");
        expect(view.get("message").textContent).not.toContain("secret-server-message");
        expect(view.get("key-FRED").value).toBe("synthetic-key");
        expect(view.get("save").disabled).toBe(false);
    });

    it.each([null, { ok: false, error: "secret-error" }, { ok: true, providers: [] }, { ok: true, providers: ids.map(id => ({ id, configured: "secret" })) }])("does not enable saving after a malformed load (%#)", response => {
        const view = sidebar();
        view.calls[0].success(response);
        expect(view.get("save").disabled).toBe(true);
        expect(view.get("reload").disabled).toBe(false);
        expect(view.get("message").textContent).toBe("Unable to load settings. Try Reload status.");
        view.get("settings").trigger("submit");
        expect(view.calls).toHaveLength(1);
    });

    it("can reload after a load failure and never displays the server exception", () => {
        const view = sidebar();
        view.get("reload").trigger("click");
        expect(view.calls).toHaveLength(1);
        view.calls[0].failure(new Error("secret-error"));
        expect(view.get("message").textContent).not.toContain("secret-error");
        view.get("reload").trigger("click");
        expect(view.calls).toHaveLength(2);
        view.calls[1].success(expectedStatus());
        expect(view.get("save").disabled).toBe(false);
    });
});
