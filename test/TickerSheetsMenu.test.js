import { afterEach, describe, expect, it, vi } from "vitest";
import { onOpen } from "../src/TickerSheetsMenu.js";
afterEach(() => vi.unstubAllGlobals());
describe("TickerSheets menu startup", () => {
    it("adds only the TickerSheets settings menu even if unrelated menus are installed", () => {
        const menu = vi.fn(), unrelated = vi.fn();
        vi.stubGlobal("TickerSheetsMenu", menu); vi.stubGlobal("TickerSheetsProviderTestMenu_", unrelated);
        onOpen(); expect(menu).toHaveBeenCalledOnce(); expect(unrelated).not.toHaveBeenCalled();
    });
});
