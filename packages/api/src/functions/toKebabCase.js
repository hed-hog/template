"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toKebabCase = void 0;
const toKebabCase = (str) => {
    return str
        .replace(/([a-z])([A-Z])/g, '$1-$2')
        .replace(/\s+/g, '-')
        .toLowerCase();
};
exports.toKebabCase = toKebabCase;
//# sourceMappingURL=toKebabCase.js.map