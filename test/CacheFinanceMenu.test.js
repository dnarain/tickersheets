import { afterEach, describe, expect, it, vi } from "vitest";
import { onOpen } from "../src/CacheFinanceMenu.js";

afterEach(() => vi.unstubAllGlobals());

describe("spreadsheet menus", () => {
    it("adds settings when the normal bundle has no diagnostic runner", () => {
        const settings = vi.fn();
        vi.stubGlobal("CFSettingsMenu_", settings);
        onOpen();
        expect(settings).toHaveBeenCalledOnce();
    });

    it("adds both settings and provider tests in the diagnostic bundle", () => {
        const settings = vi.fn(), diagnostics = vi.fn();
        vi.stubGlobal("CFSettingsMenu_", settings);
        vi.stubGlobal("CFProviderTestMenu_", diagnostics);
        onOpen();
        expect(settings).toHaveBeenCalledOnce();
        expect(diagnostics).toHaveBeenCalledOnce();
    });
});
