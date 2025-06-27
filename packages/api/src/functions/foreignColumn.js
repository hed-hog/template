"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.foreignColumn = void 0;
const foreignColumn = ({ name, isPrimary = false, isNullable = false, }) => {
    return {
        name,
        type: 'int',
        unsigned: true,
        isPrimary,
        isNullable,
    };
};
exports.foreignColumn = foreignColumn;
//# sourceMappingURL=foreignColumn.js.map