import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import vm from "node:vm";
import { CFSettingsMenu_, CFShowApiKeySettings, CFGetApiKeyStatus, CFSaveApiKeys } from "../src/CacheFinanceSettings.js";

const ids = ["FINNHUB", "ALPHA_VANTAGE", "TWELVE_DATA", "COINMARKET"];
const propertyNames = ids.map(id => `${id}_API_KEY`);
const expectedStatus = (configured = false) => ({
    ok: true,
    providers: ids.map((id, index) => ({ id, label: ["Finnhub", "Alpha Vantage", "Twelve Data", "CoinMarketCap"][index], configured }))
});

let values;
let properties;
let lock;
let menu;
let ui;
let output;
let html;

beforeEach(() => {
    values = new Map();
    properties = {
        getProperty: vi.fn(key => values.get(key) ?? null),
        setProperties: vi.fn(data => Object.entries(data).forEach(([key, value]) => values.set(key, value))),
        deleteProperty: vi.fn(key => values.delete(key))
    };
    lock = { tryLock: vi.fn(() => true), releaseLock: vi.fn() };
    menu = { addItem: vi.fn(() => menu), addToUi: vi.fn() };
    ui = { createMenu: vi.fn(() => menu), showSidebar: vi.fn(), alert: vi.fn() };
    output = { setTitle: vi.fn(() => output) };
    vi.stubGlobal("PropertiesService", { getScriptProperties: vi.fn(() => properties) });
    vi.stubGlobal("LockService", { getScriptLock: vi.fn(() => lock) });
    vi.stubGlobal("SpreadsheetApp", { getUi: vi.fn(() => ui) });
    vi.stubGlobal("HtmlService", { createHtmlOutput: vi.fn(value => { html = value; return output; }) });
});

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

describe("API key status", () => {
    it("returns only provider ids, labels and presence flags", () => {
        propertyNames.forEach((key, index) => values.set(key, `secret-${index}-never-return`));
        values.set("UNRELATED_KEY", "another-secret");
        const result = CFGetApiKeyStatus();
        expect(result).toEqual(expectedStatus(true));
        expect(JSON.stringify(result)).not.toContain("secret");
        expect(properties.getProperty.mock.calls.map(call => call[0])).toEqual(propertyNames);
    });

    it("marks missing and empty keys as not set", () => {
        values.set("FINNHUB_API_KEY", "");
        expect(CFGetApiKeyStatus()).toEqual(expectedStatus());
    });

    it("returns a fixed load error when the property service fails", () => {
        properties.getProperty.mockImplementation(() => { throw new Error("secret-in-provider-error"); });
        expect(CFGetApiKeyStatus()).toEqual({ ok: false, error: "Unable to load API key settings. Try again." });
    });
});

describe("API key saves", () => {
    it("keeps all keys for an empty update and reports no values", () => {
        values.set("FINNHUB_API_KEY", "saved-secret");
        const result = CFSaveApiKeys({ updates: [] });
        expect(result.ok).toBe(true);
        expect(result.providers[0].configured).toBe(true);
        expect(JSON.stringify(result)).not.toContain("saved-secret");
        expect(values.get("FINNHUB_API_KEY")).toBe("saved-secret");
        expect(properties.setProperties).not.toHaveBeenCalled();
        expect(properties.deleteProperty).not.toHaveBeenCalled();
    });

    it("keeps a saved key for a blank replacement", () => {
        values.set("FINNHUB_API_KEY", "saved-secret");
        expect(CFSaveApiKeys({ updates: [{ provider: "FINNHUB", action: "replace", value: "  " }] }).ok).toBe(true);
        expect(values.get("FINNHUB_API_KEY")).toBe("saved-secret");
        expect(properties.setProperties).not.toHaveBeenCalled();
    });

    it("replaces and removes only the selected properties under a script lock", () => {
        values.set("ALPHA_VANTAGE_API_KEY", "old-alpha");
        values.set("TWELVE_DATA_API_KEY", "keep-twelve");
        values.set("UNRELATED", "keep-unrelated");
        const result = CFSaveApiKeys({ updates: [
            { provider: "FINNHUB", action: "replace", value: "  new-finnhub  " },
            { provider: "ALPHA_VANTAGE", action: "remove" },
            { provider: "COINMARKET", action: "replace", value: "new-coinmarket" }
        ] });
        expect(result.ok).toBe(true);
        expect(values.get("FINNHUB_API_KEY")).toBe("new-finnhub");
        expect(values.has("ALPHA_VANTAGE_API_KEY")).toBe(false);
        expect(values.get("TWELVE_DATA_API_KEY")).toBe("keep-twelve");
        expect(values.get("UNRELATED")).toBe("keep-unrelated");
        expect(properties.setProperties).toHaveBeenCalledWith({ FINNHUB_API_KEY: "new-finnhub", COINMARKET_API_KEY: "new-coinmarket" }, false);
        expect(lock.tryLock).toHaveBeenCalledWith(5000);
        expect(lock.tryLock.mock.invocationCallOrder[0]).toBeLessThan(properties.setProperties.mock.invocationCallOrder[0]);
        expect(lock.releaseLock).toHaveBeenCalledOnce();
        expect(JSON.stringify(result)).not.toContain("new-finnhub");
    });

    it("supports all four provider keys without deleting other properties", () => {
        const result = CFSaveApiKeys({ updates: ids.map(provider => ({ provider, action: "replace", value: `synthetic-${provider}` })) });
        expect(result).toEqual(expectedStatus(true));
        expect([...values.keys()]).toEqual(propertyNames);
    });

    it.each([
        undefined, null, [], {}, { updates: null }, { updates: {} }, { updates: [], extra: true },
        { updates: [null] }, { updates: [[]] }, { updates: ["secret"] },
        { updates: [{ provider: "UNKNOWN", action: "remove" }] },
        { updates: [{ provider: "__proto__", action: "remove" }] },
        { updates: [{ provider: "FINNHUB", action: "unknown" }] },
        { updates: [{ provider: "FINNHUB", action: "remove", value: "ambiguous" }] },
        { updates: [{ provider: "FINNHUB", action: "replace" }] },
        { updates: [{ provider: "FINNHUB", action: "replace", value: null }] },
        { updates: [{ provider: "FINNHUB", action: "replace", value: 123 }] },
        { updates: [{ provider: "FINNHUB", action: "replace", value: "x", extra: true }] },
        { updates: [{ provider: "FINNHUB", action: "replace", value: "x".repeat(2049) }] },
        { updates: [{ provider: "FINNHUB", action: "replace", value: "secret\nvalue" }] },
        { updates: [{ provider: "FINNHUB", action: "replace", value: "secret\u0000value" }] },
        { updates: [{ provider: "FINNHUB", action: "replace", value: "secret\u007fvalue" }] },
        { updates: [{ provider: "FINNHUB", action: "replace", value: "secret\u2028value" }] },
        { updates: [{ provider: "FINNHUB", action: "replace", value: "secret value" }] },
        { updates: [{ provider: "FINNHUB", action: "remove" }, { provider: "FINNHUB", action: "remove" }] },
        { updates: new Array(5).fill({ provider: "FINNHUB", action: "remove" }) }
    ])("rejects an invalid request before taking a lock or changing any keys (%#)", request => {
        values.set("FINNHUB_API_KEY", "original");
        const result = CFSaveApiKeys(request);
        expect(result).toEqual({ ok: false, error: "Unable to save API keys. Check the entries and try again." });
        expect(LockService.getScriptLock).not.toHaveBeenCalled();
        expect(properties.setProperties).not.toHaveBeenCalled();
        expect(properties.deleteProperty).not.toHaveBeenCalled();
        expect(values.get("FINNHUB_API_KEY")).toBe("original");
    });

    it("validates the final update before applying earlier valid updates", () => {
        values.set("FINNHUB_API_KEY", "original");
        const result = CFSaveApiKeys({ updates: [
            { provider: "FINNHUB", action: "remove" },
            { provider: "ALPHA_VANTAGE", action: "replace", value: "invalid\nkey" }
        ] });
        expect(result.ok).toBe(false);
        expect(values.get("FINNHUB_API_KEY")).toBe("original");
        expect(properties.deleteProperty).not.toHaveBeenCalled();
    });

    it("does not change keys or release a lock it could not acquire", () => {
        lock.tryLock.mockReturnValue(false);
        expect(CFSaveApiKeys({ updates: [{ provider: "FINNHUB", action: "remove" }] }).ok).toBe(false);
        expect(properties.deleteProperty).not.toHaveBeenCalled();
        expect(lock.releaseLock).not.toHaveBeenCalled();
    });

    it.each(["getScriptLock", "tryLock", "setProperties", "deleteProperty", "getProperty"])("does not expose exceptions from %s", failingMethod => {
        const target = failingMethod === "getScriptLock" ? LockService : failingMethod === "tryLock" ? lock : properties;
        target[failingMethod].mockImplementation(() => { throw new Error("sensitive-input-in-error"); });
        const result = CFSaveApiKeys({ updates: [
            { provider: "FINNHUB", action: "replace", value: "sensitive-key" },
            { provider: "ALPHA_VANTAGE", action: "remove" }
        ] });
        expect(result).toEqual({ ok: false, error: "Unable to save API keys. Check the entries and try again." });
        if (!["getScriptLock", "tryLock"].includes(failingMethod)) expect(lock.releaseLock).toHaveBeenCalledOnce();
    });

    it("does not disclose a lock release exception", () => {
        lock.releaseLock.mockImplementation(() => { throw new Error("sensitive-release-error"); });
        expect(CFSaveApiKeys({ updates: [] })).toEqual(expectedStatus());
    });
});

function sidebar() {
    CFShowApiKeySettings();
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
        CFGetApiKeyStatus() { calls.push({ type: "load", success: this.success, failure: this.failure }); },
        CFSaveApiKeys(request) { calls.push({ type: "save", request, success: this.success, failure: this.failure }); }
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
    it("adds the public sidebar callback to the CacheFinance menu", () => {
        CFSettingsMenu_();
        expect(ui.createMenu).toHaveBeenCalledWith("CacheFinance");
        expect(menu.addItem).toHaveBeenCalledWith("API keys…", "CFShowApiKeySettings");
        expect(menu.addToUi).toHaveBeenCalledOnce();
    });

    it("opens static HTML without reading saved properties", () => {
        values.set("FINNHUB_API_KEY", "never-in-html</script>");
        CFShowApiKeySettings();
        expect(ui.showSidebar).toHaveBeenCalledWith(output);
        expect(output.setTitle).toHaveBeenCalledWith("CacheFinance API keys");
        expect(properties.getProperty).not.toHaveBeenCalled();
        expect(html).not.toContain("never-in-html");
        expect(html).toContain("People who can edit this script can access its keys.");
        expect(html).toContain("your private copy");
    });

    it("shows a fixed error if the sidebar cannot open", () => {
        HtmlService.createHtmlOutput.mockImplementation(() => { throw new Error("private-error"); });
        CFShowApiKeySettings();
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
            expect(view.get(`key-${id}`).disabled).toBe(false);
        });
    });

    it("sends only replacements and explicit removals, then clears inputs on success", () => {
        const view = sidebar();
        view.calls[0].success(expectedStatus(true));
        view.get("key-FINNHUB").value = "synthetic-finnhub";
        view.get("remove-ALPHA_VANTAGE").checked = true;
        view.get("settings").trigger("submit");
        const call = view.calls[1];
        expect(JSON.parse(JSON.stringify(call.request))).toEqual({ updates: [
            { provider: "FINNHUB", action: "replace", value: "synthetic-finnhub" },
            { provider: "ALPHA_VANTAGE", action: "remove" }
        ] });
        expect(view.get("save").disabled).toBe(true);
        expect(view.get("key-FINNHUB").disabled).toBe(true);
        view.get("settings").trigger("submit");
        expect(view.calls).toHaveLength(2);
        call.success(expectedStatus());
        ids.forEach(id => {
            expect(view.get(`key-${id}`).value).toBe("");
            expect(view.get(`remove-${id}`).checked).toBe(false);
            expect(view.get(`status-${id}`).textContent).toBe("Not set");
        });
        expect(view.get("save").disabled).toBe(false);
    });

    it("sends an empty update when fields are blank", () => {
        const view = sidebar();
        view.calls[0].success(expectedStatus(true));
        view.get("settings").trigger("submit");
        expect(JSON.parse(JSON.stringify(view.calls[1].request))).toEqual({ updates: [] });
    });

    it("rejects remove and replacement together without calling the server", () => {
        const view = sidebar();
        view.calls[0].success(expectedStatus(true));
        view.get("key-FINNHUB").value = "synthetic-key";
        view.get("remove-FINNHUB").checked = true;
        view.get("settings").trigger("submit");
        expect(view.calls).toHaveLength(1);
        expect(view.get("message").textContent).toContain("Enter a new key or select Remove");
    });

    it.each(["failure", "result"])("keeps entries and displays a fixed message after a save %s", failureType => {
        const view = sidebar();
        view.calls[0].success(expectedStatus());
        view.get("key-FINNHUB").value = "synthetic-key";
        view.get("settings").trigger("submit");
        if (failureType === "failure") view.calls[1].failure(new Error("secret-server-message"));
        else view.calls[1].success({ ok: false, error: "secret-server-message" });
        expect(view.get("message").textContent).toContain("Unable to save keys.");
        expect(view.get("message").textContent).not.toContain("secret-server-message");
        expect(view.get("key-FINNHUB").value).toBe("synthetic-key");
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
