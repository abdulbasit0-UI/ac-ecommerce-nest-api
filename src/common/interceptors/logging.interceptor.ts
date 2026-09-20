import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import type { Request, Response } from 'express';
import { AppLogger } from '../logger/app-logger';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new AppLogger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const started = Date.now();

    if (request.url === '/health' || request.url.startsWith('/health/')) {
      return next.handle();
    }

    return next.handle().pipe(
      tap({
        next: () => this.write(request, response.statusCode, started),
        error: () => this.write(request, response.statusCode || 500, started),
      }),
    );
  }

  private write(request: Request, statusCode: number, started: number): void {
    const user = (request as Request & { user?: { id?: string } }).user;
    const payload = {
      requestId: request.requestId,
      method: request.method,
      path: request.originalUrl ?? request.url,
      statusCode,
      durationMs: Date.now() - started,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
      userId: user?.id,
    };

    const message = `${request.method} ${request.originalUrl ?? request.url} ${statusCode} ${payload.durationMs}ms${request.requestId ? ` ${request.requestId}` : ''}`;
    if (statusCode >= 500) {
      this.logger.http(message, payload, 'error');
      return;
    }
    if (statusCode >= 400) {
      this.logger.http(message, payload, 'warn');
      return;
    }
    this.logger.http(message, payload);
  }
}
