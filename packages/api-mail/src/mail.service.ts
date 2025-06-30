import { HttpService } from '@nestjs/axios';
import { forwardRef, Inject, Injectable, OnModuleInit } from '@nestjs/common';
import * as mimemessage from 'mimemessage';
import { firstValueFrom } from 'rxjs';
import { MailConfigurationTypeEnum } from './enums/mail-configuration-type.enum';
import type { MailModuleOptions } from './interfaces/mail-module-options.interface';
import { Mail, MAIL_MODULE_OPTIONS } from './mail.consts';

@Injectable()
export class MailService implements OnModuleInit {
  private debug = false;

  constructor(
    @Inject(MAIL_MODULE_OPTIONS)
    private readonly mailConfig: MailModuleOptions,
    @Inject(forwardRef(() => HttpService))
    private readonly httpService: HttpService,
  ) {}

  async onModuleInit() {
    if (this.mailConfig.debug) {
      this.debug = true;
    }
  }

  private log(...args: any[]) {
    if (this.debug) {
      console.log(...args);
    }
  }

  async send(mail: Mail) {
    this.log('Sending mail:', mail);
    switch (this.mailConfig.type) {
      case MailConfigurationTypeEnum.AWS:
        return this.sendWithSES(mail);

      case MailConfigurationTypeEnum.GMAIL:
        return this.sendWithGmail(mail);

      case MailConfigurationTypeEnum.SMTP:
        return this.sendWithSMTP(mail);
    }
  }

  async createRawEmail(mail: Mail) {
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

      await Promise.all(
        (mail.attachments ?? []).map(async (attachment) => {
          const attachmentEntity = mimemessage.factory({
            contentType: attachment.contentType,
            contentTransferEncoding: 'base64',
            body: attachment.content
              .toString('base64')
              .replace(/([^\0]{76})/g, '$1\n'),
          });

          attachmentEntity.header(
            'Content-Disposition',
            `attachment; filename="${attachment.filename}"`,
          );

          mailContent.body.push(attachmentEntity);
        }),
      );

      const messageString = mailContent.toString();
      const encodedMessage = Buffer.from(messageString)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      return encodedMessage;
    } else {
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

  async sendWithSMTP(mail: Mail) {
    if (this.mailConfig.type !== 'SMTP') {
      throw new Error('Invalid mail configuration type');
    }

    const {
      password: pass,
      username: user,
      host,
      port,
      secure = false,
      rejectUnauthorized = true,
    } = this.mailConfig;

    const nodemailer = await import('nodemailer');

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

  async sendWithGmail(mail: Mail) {
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

    const { google } = await import('googleapis');
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectURI);

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

    const result = await firstValueFrom(response);

    this.log('Email sent:', result);

    return { result, mail };
  }

  async sendWithSES(mail: Mail) {
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

    const { SES } = await import('aws-sdk');

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
    } else if (!mail.bcc) {
      mail.bcc = [];
    }
    if (typeof mail.cc === 'string') {
      mail.cc = mail.cc.split(';');
    } else if (!mail.cc) {
      mail.cc = [];
    }
    if (typeof mail.replyTo === 'string') {
      mail.replyTo = mail.replyTo.split(';');
    } else if (!mail.replyTo) {
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

      await Promise.all(
        (mail.attachments ?? []).map((item) => {
          const attachmentEntity = mimemessage.factory({
            contentType: item.contentType,
            contentTransferEncoding: 'base64',
            body: item.content
              .toString('base64')
              .replace(/([^\0]{76})/g, '$1\n'),
          });

          attachmentEntity.header(
            'Content-Disposition',
            `attachment ;filename="${item.filename}"`,
          );

          mailContent.body.push(attachmentEntity);
        }),
      );

      return {
        result: await ses
          .sendRawEmail({
            RawMessage: { Data: mailContent.toString() },
          })
          .promise(),
        mail,
      };
    } else {
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
}
