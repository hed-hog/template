import { PrismaService } from '@hed-hog/api-prisma';
import { Prisma } from '@hed-hog/api-prisma';
import { HttpService } from '@nestjs/axios';
import { forwardRef, Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as mimemessage from 'mimemessage';
import { firstValueFrom } from 'rxjs';
import { MailConfigurationTypeEnum } from './enums/mail-configuration-type.enum';
import type { MailModuleOptions } from './interfaces/mail-module-options.interface';
import { Mail, MAIL_MODULE_OPTIONS } from './mail.consts';
import { renderMailTemplate } from './mail-template';

@Injectable()
export class MailService implements OnModuleInit {
  private debug = false;

  private readonly logger = new Logger(MailService.name);

  constructor(
    @Inject(MAIL_MODULE_OPTIONS)
    private mailConfig: MailModuleOptions,
    @Inject(forwardRef(() => HttpService))
    private readonly httpService: HttpService,
    @Inject(forwardRef(() => PrismaService))
    private readonly prismaService: PrismaService,
  ) { }

  async onModuleInit() {
    if (this.mailConfig.debug) {
      this.debug = true;
    }
  }

  /**
   * Reload mail configuration from database
   */
  private async reloadConfigFromDatabase() {
    try {
      const mailSettings = await this.prismaService.setting.findMany({
        where: {
          slug: {
            in: [
              'mail-provider',
              'mail-from',
              'mail-gmail-client-id',
              'mail-gmail-client-secret',
              'mail-gmail-refresh-token',
              'mail-smtp-host',
              'mail-smtp-port',
              'mail-smtp-secure',
              'mail-client-secret',
              'mail-aws-access-key-id',
              'mail-aws-secret-access-key',
              'mail-aws-region'
            ]
          }
        },
        select: {
          slug: true,
          value: true,
        }
      });

      const settings = new Map<string, string>();
      for (const setting of mailSettings) {
        settings.set(setting.slug, setting.value);
      }

      const provider = settings.get('mail-provider');
      if (!provider) {
        this.logger.warn('Mail provider not configured in database');
        return;
      }

      const config: any = {
        global: true,
      };

      switch (provider) {
        case 'GMAIL':
          Object.assign(config, {
            type: 'GMAIL',
            clientId: settings.get('mail-gmail-client-id'),
            clientSecret: settings.get('mail-gmail-client-secret'),
            refreshToken: settings.get('mail-gmail-refresh-token'),
            from: settings.get('mail-from'),
          });
          break;
        case 'SMTP':
          Object.assign(config, {
            type: 'SMTP',
            host: settings.get('mail-smtp-host'),
            port: Number(settings.get('mail-smtp-port')),
            secure: settings.get('mail-smtp-secure') === 'true',
            username: settings.get('mail-from'),
            password: settings.get('mail-client-secret'),
          });
          break;
        case 'SES':
          Object.assign(config, {
            type: 'SES',
            region: settings.get('mail-aws-region'),
            accessKeyId: settings.get('mail-aws-access-key-id'),
            secretAccessKey: settings.get('mail-aws-secret-access-key'),
            from: settings.get('mail-from'),
          });
          break;
        default:
          this.logger.warn(`Invalid mail provider: ${provider}`);
          return;
      }

      this.setConfig(config);
      this.logger.log(`Mail configuration reloaded from database (provider: ${provider})`);
    } catch (error) {
      this.logger.error('Error reloading mail configuration from database:', error);
    }
  }

  /**
   * Validate if current mail configuration has required fields
   */
  private isConfigValid(): boolean {
    if (!this.mailConfig || !this.mailConfig.type) {
      return false;
    }

    switch (this.mailConfig.type) {
      case 'GMAIL':
        return !!(this.mailConfig as any).clientId && !!(this.mailConfig as any).clientSecret && !!(this.mailConfig as any).refreshToken;
      case 'SMTP':
        return !!(this.mailConfig as any).host && !!(this.mailConfig as any).port;
      case 'SES':
        return !!(this.mailConfig as any).accessKeyId && !!(this.mailConfig as any).secretAccessKey && !!(this.mailConfig as any).region;
      default:
        return false;
    }
  }

  /**
   * Update mail configuration dynamically
   * @param config New mail configuration
   */
  setConfig(config: MailModuleOptions) {
    this.mailConfig = config;
    this.debug = config.debug || false;
    this.logger.log('Mail configuration updated');
  }

  /**
   * Get current mail configuration
   * @returns Current mail configuration (without sensitive data)
   */
  getConfig(): Partial<MailModuleOptions> {
    const { type, global, debug } = this.mailConfig;
    return { type, global, debug };
  }

  private log(...args: any[]) {
    if (this.debug) {
      console.log(...args);
    }
  }

  private normalizePrimaryRecipientEmails(to: Mail['to']): string[] {
    const values = Array.isArray(to) ? to : [to];
    const normalized = new Map<string, string>();

    for (const value of values) {
      const parts = String(value)
        .split(/[;,]/)
        .map((item) => item.trim())
        .filter(Boolean);

      for (const email of parts) {
        const key = email.toLowerCase();
        if (!normalized.has(key)) {
          normalized.set(key, email);
        }
      }
    }

    return Array.from(normalized.keys());
  }

  private async resolveRecipientUsers(to: Mail['to']) {
    const recipientEmails = this.normalizePrimaryRecipientEmails(to);

    if (!recipientEmails.length) {
      return [] as Array<{
        user_id: number;
        user_identifier_id: number;
        recipient_email: string;
      }>;
    }

    const users = await this.prismaService.$queryRaw<
      Array<{
        user_id: number;
        user_identifier_id: number;
        recipient_email: string;
      }>
    >`
      SELECT
        ui."user_id" as user_id,
        ui."id" as user_identifier_id,
        ui."value" as recipient_email
      FROM "user_identifier" ui
      WHERE ui."type" = 'email'
        AND LOWER(ui."value") IN (${Prisma.join(recipientEmails)})
    `;

    const uniqueByUser = new Map<number, (typeof users)[number]>();
    for (const user of users) {
      if (!uniqueByUser.has(user.user_id)) {
        uniqueByUser.set(user.user_id, user);
      }
    }

    return Array.from(uniqueByUser.values());
  }

  private getSendErrorCode(error: any): string | null {
    if (error?.code) {
      return String(error.code);
    }

    const status = error?.response?.status;
    if (status !== undefined && status !== null) {
      return String(status);
    }

    if (error?.name) {
      return String(error.name);
    }

    return null;
  }

  private getSendErrorMessage(error: any): string {
    if (error?.message) {
      return String(error.message);
    }

    return String(error);
  }

  private async createMailSentUserRows(
    rows: Array<{
      mail_sent_id: number | null;
      mail_id: number;
      user_id: number;
      user_identifier_id: number;
      recipient_email: string;
      status: string;
      error_code?: string | null;
      error_message?: string | null;
    }>,
  ) {
    if (!rows.length) {
      return;
    }

    const delegate = (this.prismaService as any).mail_sent_user;
    if (delegate?.createMany) {
      await delegate.createMany({
        data: rows,
      });
      return;
    }

    for (const row of rows) {
      await this.prismaService.$executeRaw`
        INSERT INTO "mail_sent_user" (
          "mail_sent_id",
          "mail_id",
          "user_id",
          "user_identifier_id",
          "recipient_email",
          "status",
          "error_code",
          "error_message"
        )
        VALUES (
          ${row.mail_sent_id},
          ${row.mail_id},
          ${row.user_id},
          ${row.user_identifier_id},
          ${row.recipient_email},
          ${row.status},
          ${row.error_code ?? null},
          ${row.error_message ?? null}
        )
      `;
    }
  }

  async send(mail: Mail) {
    // Reload configuration from database if current config is invalid
    if (!this.isConfigValid()) {
      this.logger.warn('Mail configuration is invalid or missing, reloading from database...');
      this.logger.warn(`Current config type: ${this.mailConfig?.type || 'undefined'}`);
      await this.reloadConfigFromDatabase();
      
      // Validate again after reload
      if (!this.isConfigValid()) {
        throw new Error('Mail configuration is still invalid after reloading from database. Please check mail settings in database.');
      }
    }

    const preparedMail: Mail = {
      ...mail,
      body: renderMailTemplate({
        subject: mail.subject,
        body: mail.body,
      }),
    };

    this.log('Sending mail:', preparedMail);
    this.log('Mail config:', this.mailConfig);

    let resolvedRecipientUsers: Array<{
      user_id: number;
      user_identifier_id: number;
      recipient_email: string;
    }> = [];

    if (this.prismaService && preparedMail.mail_id) {
      try {
        resolvedRecipientUsers = await this.resolveRecipientUsers(preparedMail.to);
      } catch (resolveError) {
        this.logger.error('Error resolving recipient users for mail tracking:', resolveError);
      }
    }

    try {

      let result;
      switch (this.mailConfig.type) {
        case MailConfigurationTypeEnum.SES:
          result = await this.sendWithSES(preparedMail);
          break;

        case MailConfigurationTypeEnum.GMAIL:
          result = await this.sendWithGmail(preparedMail);
          break;

        case MailConfigurationTypeEnum.SMTP:
          result = await this.sendWithSMTP(preparedMail);
          break;

        default:
          throw new Error('Invalid mail configuration type');
      }

      if (this.prismaService && preparedMail.mail_id) {
        let mailSentId: number | null = null;

        try {
          const mailSent = await this.prismaService.mail_sent.create({
            data: {
              mail_id: preparedMail.mail_id,
              subject: preparedMail.subject || '',
              from: preparedMail.from || '',
              to: Array.isArray(preparedMail.to) ? preparedMail.to.join(';') : preparedMail.to,
              cc: preparedMail.cc
                ? (Array.isArray(preparedMail.cc) ? preparedMail.cc.join(';') : preparedMail.cc)
                : null,
              bcc: preparedMail.bcc
                ? (Array.isArray(preparedMail.bcc) ? preparedMail.bcc.join(';') : preparedMail.bcc)
                : null,
              body: preparedMail.body || '',
            },
          });

          mailSentId = mailSent.id;
        } catch (dbError) {
          this.logger.error('Error saving mail_sent record:', dbError);
        }

        if (resolvedRecipientUsers.length) {
          try {
            await this.createMailSentUserRows(
              resolvedRecipientUsers.map((recipient) => ({
                mail_sent_id: mailSentId,
                mail_id: preparedMail.mail_id as number,
                user_id: recipient.user_id,
                user_identifier_id: recipient.user_identifier_id,
                recipient_email: recipient.recipient_email,
                status: 'received',
              })),
            );
          } catch (trackingError) {
            this.logger.error('Error saving mail_sent_user tracking records:', trackingError);
          }
        }
      }

      return result;
    } catch (error) {
      if (this.prismaService && preparedMail.mail_id && resolvedRecipientUsers.length) {
        try {
          await this.createMailSentUserRows(
            resolvedRecipientUsers.map((recipient) => ({
              mail_sent_id: null,
              mail_id: preparedMail.mail_id as number,
              user_id: recipient.user_id,
              user_identifier_id: recipient.user_identifier_id,
              recipient_email: recipient.recipient_email,
              status: 'error',
              error_code: this.getSendErrorCode(error),
              error_message: this.getSendErrorMessage(error),
            })),
          );
        } catch (trackingError) {
          this.logger.error('Error saving failed mail_sent_user tracking records:', trackingError);
        }
      }

      this.logger.error('Error sending mail:', error);
      throw error;
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

    // Build transport config - only include auth if credentials are provided
    const transportConfig: any = {
      host,
      port,
      secure,
      tls: {
        rejectUnauthorized,
      },
    };

    // Only add auth if user and pass are provided (skip for MailHog and other no-auth SMTP servers)
    if (user && pass) {
      transportConfig.auth = {
        user,
        pass,
      };
      this.log(`SMTP authentication enabled for user: ${user}`);
    } else {
      this.log(`SMTP authentication disabled (no credentials provided)`);
    }

    const transporter = nodemailer.createTransport(transportConfig);

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
    if (this.mailConfig.type !== 'SES') {
      throw new Error('Invalid mail configuration type');
    }
    const { region, from, accessKeyId, secretAccessKey } = this.mailConfig;

    this.log(`Sending mail with AWS SES`, {
      region,
      from,
      accessKeyId,
      secretAccessKey,
    });

    const { SESClient, SendEmailCommand, SendRawEmailCommand } = await import('@aws-sdk/client-ses');

    const sesClient = new SESClient({
      region,
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
        result: await sesClient.send(new SendRawEmailCommand({
          RawMessage: { Data: mailContent.toString() },
        })),
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

      const result = await sesClient.send(new SendEmailCommand(params));

      this.log('Email sent:', result);

      return { result, mail };
    }
  }
}
