"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WITH_ROLE = void 0;
exports.Role = Role;
const common_1 = require("@nestjs/common");
exports.WITH_ROLE = 'withRole';
function Role() {
    return (0, common_1.SetMetadata)(exports.WITH_ROLE, true);
}
//# sourceMappingURL=role.decorator.js.map