const column = text => [...text].reduce((total, letter) => total * 26 + letter.charCodeAt(0) - 64, 0);

export class ManagedRange {
    constructor(sheet, row, col, height = 1, width = 1) {
        if (![row, col, height, width].every(Number.isInteger) || Math.min(row, col, height, width) < 1) throw new Error("Invalid sheet range");
        Object.assign(this, { sheet, row, col, height, width });
    }
    each(fn) { for (let r = 0; r < this.height; r++) for (let c = 0; c < this.width; c++) fn(this.row + r, this.col + c); return this; }
    event(kind, extra = {}) { this.sheet.events.push({ kind, row: this.row, col: this.col, height: this.height, width: this.width, ...extra }); return this; }
    setValue(value) { this.each((r, c) => this.sheet.cells.set(r + ":" + c, value)); return this.event("value", { value }); }
    setValues(values) {
        if (values.length !== this.height || values.some(row => row.length !== this.width)) throw new Error("Wrong value dimensions");
        values.forEach((line, r) => line.forEach((value, c) => this.sheet.cells.set((this.row + r) + ":" + (this.col + c), value)));
        return this.event("values", { values });
    }
    getValues() { return Array.from({ length: this.height }, (_, r) => Array.from({ length: this.width }, (_, c) => this.sheet.cells.get((this.row + r) + ":" + (this.col + c)) ?? "")); }
    getValue() { return this.getValues()[0][0]; }
    setFormula(value) { this.sheet.formulas.set(this.row + ":" + this.col, value); return this.setValue(value); }
    setFormulas(values) { values.forEach((line, r) => line.forEach((value, c) => this.sheet.formulas.set((this.row + r) + ":" + (this.col + c), value))); return this.setValues(values); }
    clearContent() { this.each((r, c) => { this.sheet.cells.delete(r + ":" + c); this.sheet.formulas.delete(r + ":" + c); }); return this.event("clearContent"); }
    clear() { this.clearContent(); return this.event("clear"); }
    breakApart() { return this.event("breakApart"); }
    merge() {
        if (this.sheet.frozenColumns >= this.col && this.sheet.frozenColumns < this.col + this.width - 1
            || this.sheet.frozenRows >= this.row && this.sheet.frozenRows < this.row + this.height - 1) throw new Error("Cannot merge across a frozen boundary");
        return this.event("merge");
    }
    setNumberFormat(value) { return this.event("format", { value }); }
    setBackground(value) { return this.event("background", { value }); }
    setFontColor(value) { return this.event("fontColor", { value }); }
    setFontWeight(value) { return this.event("fontWeight", { value }); }
    setFontSize(value) { return this.event("fontSize", { value }); }
    setFontFamily(value) { return this.event("fontFamily", { value }); }
    setWrap(value) { return this.event("wrap", { value }); }
    getSheet() { return this.sheet; }
    getRow() { return this.row; } getLastRow() { return this.row + this.height - 1; }
    getColumn() { return this.col; } getLastColumn() { return this.col + this.width - 1; }
}

export class ManagedSheet {
    constructor(name) { this.name = name; this.cells = new Map(); this.formulas = new Map(); this.events = []; this.maxRows = 1000; this.maxCols = 26; }
    getName() { return this.name; } getMaxRows() { return this.maxRows; } getMaxColumns() { return this.maxCols; }
    getLastRow() { return Math.max(0, ...[...this.cells].filter(([, value]) => value !== "").map(([key]) => Number(key.split(":")[0]))); }
    getRange(a, b, height = 1, width = 1) {
        if (typeof a === "number") return new ManagedRange(this, a, b, height, width);
        const match = a.match(/^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/);
        if (!match) throw new Error("Unsupported test range");
        return new ManagedRange(this, Number(match[2]), column(match[1]), Number(match[4] || match[2]) - Number(match[2]) + 1, column(match[3] || match[1]) - column(match[1]) + 1);
    }
    getRangeList(ranges) { return { setNumberFormat: format => ranges.forEach(range => this.getRange(range).setNumberFormat(format)) }; }
    insertRowsAfter(_row, count) { this.maxRows += count; return this; } insertColumnsAfter(_col, count) { this.maxCols += count; return this; }
    setHiddenGridlines(value) { this.hiddenGridlines = value; return this; } setFrozenRows(value) { this.frozenRows = value; return this; } setFrozenColumns(value) { this.frozenColumns = value; return this; }
    setColumnWidths() { return this; } setColumnWidth() { return this; } setRowHeights() { return this; }
    hideColumns(value) { this.hiddenColumn = value; return this; }
    formatAt(row, col) { return this.events.filter(event => event.kind === "format" && row >= event.row && row < event.row + event.height && col >= event.col && col < event.col + event.width).at(-1)?.value; }
}

export class ManagedBook {
    constructor() { this.sheets = new Map(); this.toasts = []; }
    getSheetByName(name) { return this.sheets.get(name) || null; }
    insertSheet(name) { const sheet = new ManagedSheet(name); this.sheets.set(name, sheet); return sheet; }
    getSpreadsheetTimeZone() { return "America/Los_Angeles"; }
    toast(...values) { this.toasts.push(values); }
}
