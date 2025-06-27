"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getObjectFromLocaleFields = void 0;
const getLocaleFields_1 = require("./getLocaleFields");
const getObjectFromLocaleFields = (item) => {
    const fields = (0, getLocaleFields_1.getLocaleFields)(item);
    const obj = {};
    for (const field of fields) {
        obj[field.fieldNameLocale] = field.value;
    }
    return obj;
};
exports.getObjectFromLocaleFields = getObjectFromLocaleFields;
//# sourceMappingURL=getObjectFromLocaleFields.js.map