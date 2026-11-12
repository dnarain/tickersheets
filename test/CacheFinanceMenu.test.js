import { afterEach, describe, expect, it, vi } from "vitest";
import { onOpen, onEdit } from "../src/CacheFinanceMenu.js";

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
    it("adds the stock analysis menu when its builder is installed", () => {
        const settings = vi.fn(), analysis = vi.fn();
        vi.stubGlobal("CFSettingsMenu_", settings); vi.stubGlobal("CFAnalysisMenu_", analysis);
        onOpen(); expect(settings).toHaveBeenCalledOnce(); expect(analysis).toHaveBeenCalledOnce();
    });
    it("passes edits to the analysis invalidation handler without starting requests", () => {
        const handler = vi.fn(), event = { value: "AAPL" };
        vi.stubGlobal("CFAnalysisHandleEdit_", handler); onEdit(event);
        expect(handler).toHaveBeenCalledWith(event);
    });
    it("ignores edits when the analysis module is absent", () => {
        expect(() => onEdit({})).not.toThrow();
    });
});
