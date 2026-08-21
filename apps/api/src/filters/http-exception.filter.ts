import { getLocaleText } from '@hed-hog/api-locale';
import { classifyDatabaseInfraError } from '@hed-hog/api-prisma';
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

/**
 * Reconhece P2003 (foreign key constraint failed) sem importar o
 * `PrismaClientKnownRequestError`: o cliente Prisma vem de `@hed-hog/api-prisma`
 * e importar a classe de `@prisma/client` compila mas quebra em runtime.
 */
function isForeignKeyViolation(exception: Error): boolean {
  return (exception as any)?.code === 'P2003';
}

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
    /**
     * Campos extras que a própria exceção pediu para enviar ao cliente (ex.:
     * `code` + dados para a tela renderizar o erro em vez de um alerta genérico).
     * Só chega aqui o que foi colocado explicitamente no corpo da HttpException,
     * que no Nest já é, por definição, conteúdo destinado à resposta.
     */
    let details: Record<string, unknown> = {};

    // Check if exception has getStatus method (HttpException or its subclasses)
    if (typeof (exception as any)?.getStatus === 'function') {
      status = (exception as HttpException).getStatus();
      const exceptionResponse = (exception as HttpException).getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
        error = (exception as any).name || 'HttpException';
      } else if (typeof exceptionResponse === 'object') {
        const resp = exceptionResponse as any;
        const {
          statusCode: _statusCode,
          message: _message,
          error: _error,
          timestamp: _timestamp,
          path: _path,
          ...rest
        } = resp;
        details = rest;

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
      // Separa "o banco sumiu" de "o pool acabou" — os dois são 503, mas só o
      // primeiro significa que o servidor inteiro está fora, e a distinção é o que
      // dá para alertar em cima. A classificação mora em `@hed-hog/api-prisma`
      // porque o mesmo incidente também estoura fora de requisição (crons, worker
      // de fila), onde não existe filtro nenhum — ver database-outage-event-filter.
      const dbInfra = classifyDatabaseInfraError(exception);

      if (isForeignKeyViolation(exception)) {
        // Sem este ramo, qualquer violação de FK caía no fallback abaixo e
        // virava 500 "Erro interno do servidor." — o usuário não tinha como
        // saber que o registro estava só vinculado a outro.
        status = HttpStatus.CONFLICT;
        message =
          locale === 'pt'
            ? 'Este registro está vinculado a outros e não pode ser excluído.'
            : 'This record is linked to others and cannot be deleted.';
        error = 'Conflict';
        console.error(
          '[HttpExceptionFilter] Foreign key constraint violation:',
          request.url,
          msg,
        );
      } else if (dbInfra) {
        const unreachable = dbInfra === 'unreachable';

        status = HttpStatus.SERVICE_UNAVAILABLE;
        message =
          locale === 'pt'
            ? unreachable
              ? 'O servidor está temporariamente indisponível. Tente novamente em instantes.'
              : 'O servidor está temporariamente sobrecarregado. Tente novamente em instantes.'
            : unreachable
              ? 'The server is temporarily unavailable. Please try again in a moment.'
              : 'The server is temporarily overloaded. Please try again in a moment.';
        error = 'Service Unavailable';

        // O cliente pode tentar de novo: a falha é do banco, não do pedido.
        response.setHeader('Retry-After', '5');

        console.error(
          unreachable
            ? '[HttpExceptionFilter] Database unreachable:'
            : '[HttpExceptionFilter] Database connection pool exhausted:',
          msg,
        );
      } else {
        // Não expõe a mensagem/nome internos do erro ao cliente (evita vazamento
        // de detalhes de implementação, caminhos, credenciais em mensagens de
        // erro, etc.). Os detalhes completos continuam indo para o log do servidor.
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
        console.error('\x1b[33m🆔 Request ID:\x1b[0m', (request as any).requestId ?? '-');
        console.error('─'.repeat(60));
        console.error('\x1b[33m📚 Stack Trace:\x1b[0m');
        console.error('\x1b[90m' + exception.stack + '\x1b[0m');
        console.error('═'.repeat(60) + '\n');
      }
    }

    response.status(status).json({
      // Os campos canônicos vêm depois: os extras nunca sobrescrevem o envelope.
      ...details,
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
