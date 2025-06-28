"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toPascalCase = void 0;
const toPascalCase = (str) => {
    return str
        .replace(/(?:^\w|[A-Z]|\b\w)/g, (match, index) => {
        return index === 0 ? match.toUpperCase() : match.toLowerCase();
    })
        .replace(/\s+/g, '');
};
exports.toPascalCase = toPascalCase;
//# sourceMappingURL=toPascalCase.js.map