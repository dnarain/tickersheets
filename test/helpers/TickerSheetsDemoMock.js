import { vi } from "vitest";
import { ManagedBook } from "./ManagedSheetMock.js";

export function tutorialBook() {
    const book = new ManagedBook(), insert = book.insertSheet.bind(book);
    book.deleted = [];
    book.insertSheet = name => {
        const sheet = insert(name), getRange = sheet.getRange.bind(sheet);
        sheet.getRange = (...args) => {
            const range = getRange(...args), writeValue = range.setValue.bind(range), writeValues = range.setValues.bind(range);
            range.setValue = value => { range.each((row, col) => sheet.formulas.delete(row + ":" + col)); return writeValue(value); };
            range.setValues = values => { range.each((row, col) => sheet.formulas.delete(row + ":" + col)); return writeValues(values); };
            range.setFormula = formula => { writeValue(formula); sheet.formulas.set(range.row + ":" + range.col, formula); return range; };
            range.setFormulas = values => {
                writeValues(values);
                values.forEach((row, r) => row.forEach((formula, c) => {
                    const key = (range.row + r) + ":" + (range.col + c);
                    if (formula) sheet.formulas.set(key, formula); else sheet.formulas.delete(key);
                }));
                return range;
            };
            range.setVerticalAlignment = value => range.event("verticalAlignment", { value });
            range.setDataValidation = value => range.event("validation", { value });
            range.getDisplayValues = () => range.getValues().map(row => row.map(String));
            return range;
        };
        sheet.charts = [];
        sheet.getCharts = () => sheet.charts;
        sheet.removeChart = chart => { sheet.charts = sheet.charts.filter(item => item !== chart); };
        sheet.newChart = () => {
            const state = { ranges: [], options: {} };
            return { setChartType(type) { state.type = type; return this; }, addRange(range) { state.ranges.push(range); return this; },
                setNumHeaders(value) { state.headers = value; return this; }, setPosition(...value) { state.position = value; return this; },
                setOption(key, value) { state.options[key] = value; return this; }, build() { return state; } };
        };
        sheet.insertChart = chart => { sheet.charts.push(chart); return sheet; };
        sheet.setTabColor = () => sheet;
        sheet.showColumns = () => sheet;
        sheet.hideSheet = vi.fn(() => sheet);
        sheet.showSheet = vi.fn(() => sheet);
        sheet.getLastColumn = () => Math.max(1, ...[...sheet.cells.keys()].map(key => Number(key.split(":")[1])));
        return sheet;
    };
    book.deleteSheet = sheet => { book.deleted.push(sheet.getName()); book.sheets.delete(sheet.getName()); };
    book.setActiveSheet = sheet => { book.active = sheet; return sheet; };
    book.moveActiveSheet = vi.fn(position => {
        const entries = [...book.sheets].filter(([, sheet]) => sheet !== book.active);
        entries.splice(position - 1, 0, [book.active.getName(), book.active]);
        book.sheets = new Map(entries);
    });
    return book;
}
