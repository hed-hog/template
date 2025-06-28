"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLocalesFromItem = void 0;
const getLocalesFromItem = (item) => {
    if (item) {
        const fields = [];
        for (const itemLocale of item.locale ?? []) {
            fields.push(itemLocale.locale.code);
        }
        return [...new Set(fields)];
    }
    else {
        return [];
    }
};
exports.getLocalesFromItem = getLocalesFromItem;
//# sourceMappingURL=getLocalesFromItem.js.map