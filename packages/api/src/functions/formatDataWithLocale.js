"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatDataWithLocale = void 0;
const formatDataWithLocale = (data) => {
    const newData = {
        locale: {},
    };
    for (const key of Object.keys(data)) {
        if (key !== 'locale') {
            const keys = key.split('-');
            if (keys.length === 1) {
                newData[keys[0]] = data[keys[0]];
            }
            else {
                if (!newData.locale[keys[0]]) {
                    newData.locale[keys[0]] = {};
                }
                newData.locale[keys[0]][keys[1]] = data[key];
            }
        }
    }
    return newData;
};
exports.formatDataWithLocale = formatDataWithLocale;
//# sourceMappingURL=formatDataWithLocale.js.map