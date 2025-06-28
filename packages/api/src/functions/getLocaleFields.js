"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLocaleFields = void 0;
const getLocaleFields = (item) => {
    const fields = [];
    for (const itemLocale of item.locale ?? []) {
        for (const key in itemLocale) {
            if (key !== 'locale') {
                fields.push({
                    fieldName: key,
                    fieldNameLocale: `${itemLocale.locale.code}-${key}`,
                    localeCode: itemLocale.locale.code,
                    value: itemLocale[key],
                });
            }
        }
    }
    return fields;
};
exports.getLocaleFields = getLocaleFields;
//# sourceMappingURL=getLocaleFields.js.map