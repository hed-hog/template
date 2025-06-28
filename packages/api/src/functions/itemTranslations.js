"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.itemTranslations = void 0;
const itemTranslations = (translationKey, item) => {
    let locale = {};
    if (item[translationKey] && item[translationKey]?.length > 0) {
        locale = { ...item[translationKey][0] };
    }
    delete item[translationKey];
    return {
        ...item,
        ...locale,
    };
};
exports.itemTranslations = itemTranslations;
//# sourceMappingURL=itemTranslations.js.map