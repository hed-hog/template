"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.timestampColumn = void 0;
const timestampColumn = (name = 'created_at') => {
    return {
        name,
        type: 'timestamp',
        default: 'CURRENT_TIMESTAMP',
    };
};
exports.timestampColumn = timestampColumn;
//# sourceMappingURL=timestampColumn.js.map