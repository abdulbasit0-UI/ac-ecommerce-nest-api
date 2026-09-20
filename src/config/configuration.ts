import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class DatabaseConfig {
  @IsString()
  host!: string;

  @IsInt()
  @Min(1)
  port!: number;

  @IsString()
  username!: string;

  @IsString()
  password!: string;

  @IsString()
  name!: string;

  @IsBoolean()
  synchronize!: boolean;

  @IsBoolean()
  logging!: boolean;
}

export class JwtConfig {
  @IsString()
  @MinLength(32)
  accessSecret!: string;

  @IsString()
  accessExpiresIn!: string;

  @IsString()
  @MinLength(32)
  refreshSecret!: string;

  @IsString()
  refreshExpiresIn!: string;
}

export class MailConfig {
  @IsString()
  host!: string;

  @IsInt()
  port!: number;

  @IsOptional()
  @IsString()
  user?: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsString()
  from!: string;
}

export class AwsConfig {
  @IsString()
  region!: string;

  @IsOptional()
  @IsString()
  accessKeyId?: string;

  @IsOptional()
  @IsString()
  secretAccessKey?: string;

  @IsString()
  bucket!: string;

  @IsOptional()
  @IsString()
  publicBaseUrl?: string;
}

export class StripeConfig {
  @IsString()
  secretKey!: string;

  @IsString()
  webhookSecret!: string;

  @IsString()
  currency!: string;
}

export class AppConfig {
  @IsString()
  nodeEnv!: string;

  @IsString()
  name!: string;

  @IsInt()
  port!: number;

  @IsString()
  appUrl!: string;

  @IsString()
  frontendUrl!: string;

  @ValidateNested()
  @Type(() => DatabaseConfig)
  database!: DatabaseConfig;

  @IsString()
  redisHost!: string;

  @IsInt()
  redisPort!: number;

  @IsOptional()
  @IsString()
  redisPassword?: string;

  @IsInt()
  cacheTtlSeconds!: number;

  @ValidateNested()
  @Type(() => JwtConfig)
  jwt!: JwtConfig;

  @ValidateNested()
  @Type(() => MailConfig)
  mail!: MailConfig;

  @ValidateNested()
  @Type(() => AwsConfig)
  aws!: AwsConfig;

  @ValidateNested()
  @Type(() => StripeConfig)
  stripe!: StripeConfig;

  @IsEmail()
  seedAdminEmail!: string;

  @IsString()
  seedAdminPassword!: string;

  @IsString()
  seedAdminFirstName!: string;

  @IsString()
  seedAdminLastName!: string;

  @IsInt()
  throttleTtl!: number;

  @IsInt()
  throttleLimit!: number;

  @IsString()
  logLevel!: string;

  @IsBoolean()
  logPretty!: boolean;
}

export function configuration(): AppConfig {
  return {
    nodeEnv: process.env.NODE_ENV ?? 'development',
    name: process.env.APP_NAME ?? 'AC Commerce',
    port: Number(process.env.APP_PORT ?? 3000),
    appUrl: process.env.APP_URL ?? 'http://localhost:3000',
    frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3001',
    database: {
      host: process.env.DB_HOST ?? 'localhost',
      port: Number(process.env.DB_PORT ?? 5432),
      username: process.env.DB_USERNAME ?? 'accommerce',
      password: process.env.DB_PASSWORD ?? 'accommerce',
      name: process.env.DB_NAME ?? 'accommerce',
      synchronize: (process.env.DB_SYNC ?? 'true') === 'true',
      logging: (process.env.DB_LOGGING ?? 'false') === 'true',
    },
    redisHost: process.env.REDIS_HOST ?? 'localhost',
    redisPort: Number(process.env.REDIS_PORT ?? 6379),
    redisPassword: process.env.REDIS_PASSWORD || undefined,
    cacheTtlSeconds: Number(process.env.CACHE_TTL_SECONDS ?? 60),
    jwt: {
      accessSecret: process.env.JWT_ACCESS_SECRET ?? 'change-me-access-secret-min-32-chars',
      accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
      refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'change-me-refresh-secret-min-32-chars',
      refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
    },
    mail: {
      host: process.env.MAIL_HOST ?? 'localhost',
      port: Number(process.env.MAIL_PORT ?? 1025),
      user: process.env.MAIL_USER || undefined,
      password: process.env.MAIL_PASSWORD || undefined,
      from: process.env.MAIL_FROM ?? 'AC Commerce <noreply@accommerce.dev>',
    },
    aws: {
      region: process.env.AWS_REGION ?? 'us-east-1',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || undefined,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || undefined,
      bucket: process.env.AWS_S3_BUCKET ?? 'ac-commerce-media',
      publicBaseUrl: process.env.AWS_S3_PUBLIC_BASE_URL || undefined,
    },
    stripe: {
      secretKey: process.env.STRIPE_SECRET_KEY ?? 'sk_test_replace_me',
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? 'whsec_replace_me',
      currency: process.env.STRIPE_CURRENCY ?? 'usd',
    },
    seedAdminEmail: process.env.SEED_ADMIN_EMAIL ?? 'admin@accommerce.dev',
    seedAdminPassword: process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!',
    seedAdminFirstName: process.env.SEED_ADMIN_FIRST_NAME ?? 'Store',
    seedAdminLastName: process.env.SEED_ADMIN_LAST_NAME ?? 'Admin',
    throttleTtl: Number(process.env.THROTTLE_TTL_SECONDS ?? 60),
    throttleLimit: Number(process.env.THROTTLE_LIMIT ?? 100),
    logLevel: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
    logPretty: (process.env.LOG_PRETTY ?? (process.env.NODE_ENV === 'production' ? 'false' : 'true')) === 'true',
  };
}
