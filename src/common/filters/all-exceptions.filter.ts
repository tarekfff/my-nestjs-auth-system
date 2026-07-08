import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { Response } from 'express';

const DEFAULT_CODE_BY_STATUS: Record<number, string> = {
  400: 'invalid_request',
  401: 'unauthorized',
  403: 'forbidden',
  404: 'not_found',
  409: 'conflict',
  423: 'locked',
  429: 'rate_limited',
  500: 'internal_error',
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const requestId = randomUUID();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'internal_error';
    let message = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();

      if (typeof body === 'string') {
        message = body;
        code = DEFAULT_CODE_BY_STATUS[status] ?? 'error';
      } else if (typeof body === 'object' && body !== null) {
        const candidate = body as {
          code?: string;
          message?: string | string[];
        };
        code = candidate.code ?? DEFAULT_CODE_BY_STATUS[status] ?? 'error';
        message = Array.isArray(candidate.message)
          ? candidate.message.join('; ')
          : (candidate.message ?? exception.message);
      }
    }

    response
      .status(status)
      .json({ error: { code, message, request_id: requestId } });
  }
}
