import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { QueryFailedError } from 'typeorm';
import { AppLogger } from '../logger/app-logger';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new AppLogger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let error = 'Internal Server Error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
        error = exception.name;
      } else {
        const payload = body as { message?: string | string[]; error?: string };
        message = payload.message ?? exception.message;
        error = payload.error ?? exception.name;
      }
    } else if (exception instanceof QueryFailedError) {
      status = HttpStatus.BAD_REQUEST;
      message = 'Database constraint failed';
      error = 'QueryFailedError';
    }

    const stack = exception instanceof Error ? exception.stack : undefined;
    const logPayload = {
      requestId: request.requestId,
      method: request.method,
      path: request.url,
      statusCode: status,
    };

    if (status >= 500) {
      this.logger.exception(message, logPayload, stack, 'error');
    } else {
      this.logger.exception(message, logPayload, undefined, 'warn');
    }

    response.status(status).json({
      success: false,
      statusCode: status,
      error,
      message,
      path: request.url,
      requestId: request.requestId,
      timestamp: new Date().toISOString(),
    });
  }
}
