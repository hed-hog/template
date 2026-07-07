import { getLocaleText } from '@hed-hog/api-locale';
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const locale = request['locale'] || 'en';

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: any = 'Internal server error';
    let error = 'Internal Server Error';

    // Check if exception has getStatus method (HttpException or its subclasses)
    if (typeof (exception as any)?.getStatus === 'function') {
      status = (exception as HttpException).getStatus();
      const exceptionResponse = (exception as HttpException).getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
        error = (exception as any).name || 'HttpException';
      } else if (typeof exceptionResponse === 'object') {
        const resp = exceptionResponse as any;
        
        // Preserve original message structure for validation errors
        if (Array.isArray(resp.message) && status === 400) {
          // Transform array messages to object with field names
          message = this.transformValidationMessages(resp.message, locale);
        } else if (Array.isArray(resp.message)) {
          message = resp.message.map(msg => this.translateMessage(msg, locale));
        } else if (typeof resp.message === 'string') {
          message = this.translateMessage(resp.message, locale);
        } else {
          message = resp.message;
        }
        
        error = resp.error || (exception as any).name || 'HttpException';
      }
    } else if (exception instanceof Error) {
      const msg = exception.message ?? '';

      if (
        msg.includes('too many clients') ||
        msg.includes('Too many database connections') ||
        msg.includes('connection pool')
      ) {
        status = HttpStatus.SERVICE_UNAVAILABLE;
        message =
          locale === 'pt'
            ? 'O servidor está temporariamente sobrecarregado. Tente novamente em instantes.'
            : 'The server is temporarily overloaded. Please try again in a moment.';
        error = 'Service Unavailable';
        console.error('[HttpExceptionFilter] Database connection pool exhausted:', msg);
      } else {
        // Does not expose the error's internal message/name to the client (avoids
        // leaking implementation details, paths, credentials in error messages,
        // etc.). Full details still go to the server log.
        message =
          locale === 'pt'
            ? 'Erro interno do servidor.'
            : 'Internal server error.';
        error = 'Internal Server Error';

        console.error('\n' + '═'.repeat(60));
        console.error('🚨 \x1b[31m\x1b[1mUNHANDLED ERROR\x1b[0m 🚨');
        console.error('═'.repeat(60));
        console.error('\x1b[33m📛 Error Name:\x1b[0m', exception.name);
        console.error('\x1b[33m💬 Message:\x1b[0m', exception.message);
        console.error('\x1b[33m🕐 Timestamp:\x1b[0m', new Date().toISOString());
        console.error('\x1b[33m🔗 Path:\x1b[0m', request.url);
        console.error('─'.repeat(60));
        console.error('\x1b[33m📚 Stack Trace:\x1b[0m');
        console.error('\x1b[90m' + exception.stack + '\x1b[0m');
        console.error('═'.repeat(60) + '\n');
      }
    }

    response.status(status).json({
      statusCode: status,
      message,
      error,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }

  private transformValidationMessages(messages: any[], locale: string): Record<string, string[]> {
    const fieldErrors: Record<string, string[]> = {};

    for (const msg of messages) {
      if (typeof msg === 'string') {
        let fieldName = 'unknown';
        
        // Extract field name from patterns like "fieldName must be..."
        const patterns = [
          /^(\w+) must be/i,
          /^(\w+) should/i,
          /^(\w+) is required/i,
        ];
        
        for (const pattern of patterns) {
          const match = msg.match(pattern);
          if (match) {
            fieldName = match[1];
            break;
          }
        }

        const translatedMsg = this.translateMessage(msg, locale);
        
        if (!fieldErrors[fieldName]) {
          fieldErrors[fieldName] = [];
        }
        fieldErrors[fieldName].push(translatedMsg);
      }
    }

    return fieldErrors;
  }

  private translateMessage(message: string, locale: string): string {
    // Map patterns to translation keys
    const translationMap: Array<{ pattern: RegExp; key: string }> = [
      { pattern: /must be a string$/i, key: 'validation.stringRequired' },
      { pattern: /must be a boolean$/i, key: 'validation.booleanRequired' },
      { pattern: /must be an integer$/i, key: 'validation.numberRequired' },
      { pattern: /must be at most (\d+) characters long$/i, key: 'validation.maxLength' },
    ];

    for (const { pattern, key } of translationMap) {
      if (pattern.test(message)) {
        const translated = getLocaleText(key, locale);
        
        // Handle interpolation for maxLength
        if (key === 'validation.maxLength') {
          const match = message.match(/(\d+)/);
          if (match) {
            return translated.replace('{max}', match[1]);
          }
        }
        
        return translated;
      }
    }

    return message;
  }
}
