"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MailService = void 0;
const axios_1 = require("@nestjs/axios");
const common_1 = require("@nestjs/common");
const mimemessage = __importStar(require("mimemessage"));
const rxjs_1 = require("rxjs");
const mail_configuration_type_enum_1 = require("./enums/mail-configuration-type.enum");
const mail_consts_1 = require("./mail.consts");
let MailService = class MailService {
    mailConfig;
    httpService;
    debug = false;
    constructor(mailConfig, httpService) {
        this.mailConfig = mailConfig;
        this.httpService = httpService;
    }
    async onModuleInit() {
        if (this.mailConfig.debug) {
            this.debug = true;
        }
    }
    log(...args) {
        if (this.debug) {
            console.log(...args);
        }
    }
    async send(mail) {
        this.log('Sending mail:', mail);
        switch (this.mailConfig.type) {
            case mail_configuration_type_enum_1.MailConfigurationTypeEnum.AWS:
                return this.sendWithSES(mail);
            case mail_configuration_type_enum_1.MailConfigurationTypeEnum.GMAIL:
                return this.sendWithGmail(mail);
            case mail_configuration_type_enum_1.MailConfigurationTypeEnum.SMTP:
                return this.sendWithSMTP(mail);
        }
    }
    async createRawEmail(mail) {
        if (mail.attachments instanceof Array && mail.attachments?.length) {
            const mailContent = mimemessage.factory({
                contentType: 'multipart/mixed;charset=utf-8',
                body: [],
            });
            mailContent.header('From', mail.from);
            mailContent.header('To', mail.to);
            mailContent.header('Subject', mail.subject);
            const alternateEntity = mimemessage.factory({
                contentType: 'multipart/alternate',
                body: [],
            });
            const htmlEntity = mimemessage.factory({
                contentType: 'text/html;charset=utf-8',
                body: mail.body,
            });
            alternateEntity.body.push(htmlEntity);
            mailContent.body.push(alternateEntity);
            await Promise.all((mail.attachments ?? []).map(async (attachment) => {
                const attachmentEntity = mimemessage.factory({
                    contentType: attachment.contentType,
                    contentTransferEncoding: 'base64',
                    body: attachment.content
                        .toString('base64')
                        .replace(/([^\0]{76})/g, '$1\n'),
                });
                attachmentEntity.header('Content-Disposition', `attachment; filename="${attachment.filename}"`);
                mailContent.body.push(attachmentEntity);
            }));
            const messageString = mailContent.toString();
            const encodedMessage = Buffer.from(messageString)
                .toString('base64')
                .replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=+$/, '');
            return encodedMessage;
        }
        else {
            const encodedSubject = `=?utf-8?B?${Buffer.from(mail.subject).toString('base64')}?=`;
            const messageParts = [
                'Content-Type: text/html;charset=utf-8',
                `From: ${mail.from}`,
                `To: ${mail.to instanceof Array ? mail.to.join(',') : mail.to}`,
                `Subject: ${encodedSubject}`,
                '',
                mail.body,
            ];
            const message = messageParts.join('\n');
            const encodedMessage = Buffer.from(message)
                .toString('base64')
                .replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=+$/, '');
            return encodedMessage;
        }
    }
    async sendWithSMTP(mail) {
        if (this.mailConfig.type !== 'SMTP') {
            throw new Error('Invalid mail configuration type');
        }
        const { password: pass, username: user, host, port, secure = false, rejectUnauthorized = true, } = this.mailConfig;
        const nodemailer = await Promise.resolve().then(() => __importStar(require('nodemailer')));
        this.log(`Sending mail with SMTP`, {
            host,
            port,
            secure,
            user,
            pass,
            rejectUnauthorized,
        });
        const transporter = nodemailer.createTransport({
            host,
            port,
            secure,
            auth: {
                user,
                pass,
            },
            tls: {
                rejectUnauthorized,
            },
        });
        const result = await transporter.sendMail({
            from: mail.from || process.env.SMTP_FROM || process.env.SMTP_USER,
            to: mail.to,
            subject: mail.subject,
            html: mail.body,
            cc: mail.cc,
            bcc: mail.bcc,
            replyTo: mail.replyTo,
            priority: mail.priority,
        });
        this.log('Email sent:', result);
        return { result, mail };
    }
    async sendWithGmail(mail) {
        if (this.mailConfig.type !== 'GMAIL') {
            throw new Error('Invalid mail configuration type');
        }
        const { clientId, clientSecret, from, refreshToken } = this.mailConfig;
        const redirectURI = 'https://developers.google.com/oauthplayground';
        this.log(`Sending mail with Gmail`, {
            clientId,
            clientSecret,
            from,
            refreshToken,
        });
        const { auth } = await Promise.resolve().then(() => __importStar(require('googleapis/build/src/apis/oauth2')));
        const oauth2Client = new auth.OAuth2(clientId, clientSecret, redirectURI);
        oauth2Client.setCredentials({
            refresh_token: refreshToken,
        });
        const { token } = await oauth2Client.getAccessToken();
        const raw = await this.createRawEmail({
            ...mail,
            from,
        });
        const url = 'https://www.googleapis.com/gmail/v1/users/me/messages/send';
        const requestBody = {
            raw,
        };
        const headers = {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        };
        const response = this.httpService.post(url, requestBody, { headers });
        const result = await (0, rxjs_1.firstValueFrom)(response);
        this.log('Email sent:', result);
        return { result, mail };
    }
    async sendWithSES(mail) {
        if (this.mailConfig.type !== 'AWS') {
            throw new Error('Invalid mail configuration type');
        }
        const { region, from, accessKeyId, secretAccessKey } = this.mailConfig;
        this.log(`Sending mail with AWS SES`, {
            region,
            from,
            accessKeyId,
            secretAccessKey,
        });
        const { SES } = await Promise.resolve().then(() => __importStar(require('aws-sdk')));
        const ses = new SES({
            apiVersion: '2010-12-01',
            region,
            credentials: {
                accessKeyId,
                secretAccessKey,
            },
        });
        ses.config.update({
            credentials: {
                accessKeyId,
                secretAccessKey,
            },
        });
        if (typeof mail.to === 'string') {
            mail.to = mail.to.split(';');
        }
        if (typeof mail.bcc === 'string') {
            mail.bcc = mail.bcc.split(';');
        }
        else if (!mail.bcc) {
            mail.bcc = [];
        }
        if (typeof mail.cc === 'string') {
            mail.cc = mail.cc.split(';');
        }
        else if (!mail.cc) {
            mail.cc = [];
        }
        if (typeof mail.replyTo === 'string') {
            mail.replyTo = mail.replyTo.split(';');
        }
        else if (!mail.replyTo) {
            mail.replyTo = [];
        }
        if (mail.attachments instanceof Array && mail.attachments.length > 0) {
            const mailContent = mimemessage.factory({
                contentType: 'multipart/mixed',
                body: [],
            });
            mailContent.header('From', from);
            mailContent.header('To', mail.to);
            mailContent.header('Subject', mail.subject);
            const alternateEntity = mimemessage.factory({
                contentType: 'multipart/alternate',
                body: [],
            });
            const htmlEntity = mimemessage.factory({
                contentType: 'text/html;charset=utf-8',
                body: mail.body,
            });
            alternateEntity.body.push(htmlEntity);
            mailContent.body.push(alternateEntity);
            await Promise.all((mail.attachments ?? []).map((item) => {
                const attachmentEntity = mimemessage.factory({
                    contentType: item.contentType,
                    contentTransferEncoding: 'base64',
                    body: item.content
                        .toString('base64')
                        .replace(/([^\0]{76})/g, '$1\n'),
                });
                attachmentEntity.header('Content-Disposition', `attachment ;filename="${item.filename}"`);
                mailContent.body.push(attachmentEntity);
            }));
            return {
                result: await ses
                    .sendRawEmail({
                    RawMessage: { Data: mailContent.toString() },
                })
                    .promise(),
                mail,
            };
        }
        else {
            const params = {
                Destination: {
                    ToAddresses: mail.to,
                    BccAddresses: mail.bcc,
                    CcAddresses: mail.cc,
                },
                Message: {
                    Body: {
                        Html: {
                            Data: mail.body,
                            Charset: 'utf-8',
                        },
                        Text: {
                            Data: mail.body,
                            Charset: 'utf-8',
                        },
                    },
                    Subject: {
                        Data: mail.subject,
                        Charset: 'utf-8',
                    },
                },
                ReplyToAddresses: mail.replyTo,
                Source: from,
            };
            const result = await ses.sendEmail(params).promise();
            this.log('Email sent:', result);
            return { result, mail };
        }
    }
};
exports.MailService = MailService;
exports.MailService = MailService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(mail_consts_1.MAIL_MODULE_OPTIONS)),
    __param(1, (0, common_1.Inject)((0, common_1.forwardRef)(() => axios_1.HttpService))),
    __metadata("design:paramtypes", [Object, axios_1.HttpService])
], MailService);
//# sourceMappingURL=mail.service.js.map