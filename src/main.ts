import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { config as loadEnv } from 'dotenv';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { AppLogger } from './common/logger/app-logger';
import { configuration } from './config/configuration';

loadEnv();

async function bootstrap() {
  const appConfig = configuration();
  const logger = new AppLogger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
    bufferLogs: true,
    logger,
  });
  app.useLogger(logger);

  const httpAdapter = app.getHttpAdapter();
  if (typeof httpAdapter.getInstance === 'function') {
    const instance = httpAdapter.getInstance() as { set?: (key: string, value: unknown) => void };
    instance.set?.('trust proxy', 1);
  }

  app.setGlobalPrefix('api/v1', { exclude: ['health', 'health/live'] });
  app.use(helmet());
  app.enableCors({ origin: appConfig.frontendUrl, credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableShutdownHooks();

  if (appConfig.nodeEnv !== 'production') {
    const swagger = new DocumentBuilder()
      .setTitle('AC Commerce API')
      .setDescription(
        'End-to-end NestJS commerce API: catalog, customers, orders, Stripe payments, AWS uploads, and RBAC.',
      )
      .setVersion('1.0.0')
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'access-token')
      .addTag('auth')
      .addTag('users')
      .addTag('roles')
      .addTag('customers')
      .addTag('categories')
      .addTag('products')
      .addTag('uploads')
      .addTag('cart')
      .addTag('orders')
      .addTag('payments')
      .addTag('health')
      .build();

    const document = SwaggerModule.createDocument(app, swagger);
    SwaggerModule.setup('docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  await app.listen(appConfig.port, '0.0.0.0');
  logger.log(`Listening on ${appConfig.appUrl} (${appConfig.nodeEnv})`);
}

void bootstrap();
