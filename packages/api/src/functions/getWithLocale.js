"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWithLocale = void 0;
const getWithLocale = (localeCode, tableLocaleName, data) => {
    const locale = [...data[tableLocaleName]];
    delete data[tableLocaleName];
    const newData = { ...data, locale };
    const current = locale.find((l) => l.locale.code === localeCode);
    for (const key in current) {
        if (key !== 'locale') {
            newData[key] = current[key];
        }
    }
    return newData;
};
exports.getWithLocale = getWithLocale;
//# sourceMappingURL=getWithLocale.js.map