"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var MailModule_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MailModule = void 0;
const axios_1 = require("@nestjs/axios");
const common_1 = require("@nestjs/common");
const mail_consts_1 = require("./mail.consts");
const mail_service_1 = require("./mail.service");
let MailModule = MailModule_1 = class MailModule {
    static forRoot(options) {
        return {
            module: MailModule_1,
            imports: [axios_1.HttpModule],
            providers: [
                mail_service_1.MailService,
                {
                    provide: mail_consts_1.MAIL_MODULE_OPTIONS,
                    useValue: options,
                },
            ],
            exports: [mail_service_1.MailService],
        };
    }
    static forRootAsync(options) {
        return {
            module: MailModule_1,
            imports: [...(options.imports || []), axios_1.HttpModule],
            providers: [mail_service_1.MailService, this.createAsyncOptionsProvider(options)],
            exports: [mail_service_1.MailService],
        };
    }
    static createAsyncOptionsProvider(options) {
        return {
            provide: mail_consts_1.MAIL_MODULE_OPTIONS,
            useFactory: options.useFactory,
            inject: options.inject || [],
        };
    }
};
exports.MailModule = MailModule;
exports.MailModule = MailModule = MailModule_1 = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({})
], MailModule);
//# sourceMappingURL=mail.module.js.map