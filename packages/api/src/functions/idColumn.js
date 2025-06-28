"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.idColumn = void 0;
const idColumn = (name = 'id') => {
    return {
        name,
        type: 'int',
        isPrimary: true,
        isGenerated: true,
        generationStrategy: 'increment',
        unsigned: true,
    };
};
exports.idColumn = idColumn;
//# sourceMappingURL=idColumn.js.map