# AC Commerce

NestJS e-commerce API for a store catalog, customers, orders, Stripe payments, and AWS S3 media. Built as a complete backend you can run locally and walk through in Swagger.

The storefront and staff console live in a separate Next.js app:

- **Frontend:** [ac-ecommerce-frontend](https://github.com/abdulbasit0-UI/ac-ecommerce-frontend)

## Stack

- NestJS 11 + TypeScript
- PostgreSQL + TypeORM
- Redis cache
- JWT access + rotating refresh tokens
- Role / permission RBAC
- Email verification and password reset (Mailhog locally)
- Stripe PaymentIntents, webhooks, and refunds
- AWS S3 uploads (direct + presigned)
- Swagger at `/docs`

## Local setup

1. Copy environment values:

```bash
copy .env.example .env
```

2. Start Postgres, Redis, and Mailhog:

```bash
docker compose up -d
```

3. Install dependencies, then run the API (you own install / build):

```bash
npm install
npm run start:dev
```

4. Seed roles, an admin user, and a sample product:

```bash
npm run seed
```

Default admin from `.env.example`:

- Email: `admin@accommerce.dev`
- Password: `ChangeMe123!`

API: `http://localhost:3000/api/v1`  
Swagger: `http://localhost:3000/docs`  
Mailhog UI: `http://localhost:8025`  
Health: `http://localhost:3000/health`

Set `DB_SYNC=true` for the first local boot so TypeORM creates tables. Turn it off in production and generate migrations with `npm run migration:generate -- src/database/migrations/InitSchema`.

## Auth flow

1. `POST /api/v1/auth/register` creates a `CUSTOMER` user + customer profile and emails a verification link.
2. Confirm with `POST /api/v1/auth/verify-email`.
3. `POST /api/v1/auth/login` returns an access token (15m) and refresh token (7d).
4. Send `Authorization: Bearer <accessToken>` on protected routes.
5. Rotate with `POST /api/v1/auth/refresh`. Forgot / reset password are on the same controller.

Staff routes check both role and permission slugs (`products:write`, `payments:refund`, and so on). Super admin bypasses permission checks.

## Commerce flow

1. Browse `GET /api/v1/products` and `GET /api/v1/categories` (public, Redis-cached).
2. Authenticated customer: add addresses, manage cart, checkout.
3. Checkout creates an order in `PENDING_PAYMENT` and a Stripe PaymentIntent. The response includes `clientSecret` for Stripe.js.
4. Stripe webhook `POST /api/v1/payments/webhooks/stripe` marks the order paid, decrements stock, and sends the confirmation email.
5. Staff can move `PAID → PROCESSING → SHIPPED → DELIVERED`.
6. `POST /api/v1/payments/orders/:orderId/refunds` issues a Stripe refund (full or partial), restocks on a full refund, and emails the customer.

Configure the webhook endpoint in Stripe to that path and paste `STRIPE_WEBHOOK_SECRET` into `.env`. For local testing use the Stripe CLI:

```bash
stripe listen --forward-to localhost:3000/api/v1/payments/webhooks/stripe
```

## AWS images

- `POST /api/v1/uploads/product-image` — multipart upload from staff
- `POST /api/v1/uploads/presign` — browser-direct PUT URL
- Attach the returned `key` + `url` with `POST /api/v1/products/:id/images`

## Modules

| Area | Path | Notes |
| --- | --- | --- |
| Auth | `src/modules/auth` | Register, verify, login, refresh, reset |
| Users / roles | `src/modules/users`, `src/modules/roles` | RBAC + admin user CRUD |
| Customers | `src/modules/customers` | Profiles and addresses |
| Catalog | `src/modules/categories`, `src/modules/products` | Nested categories, stock, images |
| Cart / orders | `src/modules/cart`, `src/modules/orders` | Checkout, status history |
| Payments | `src/modules/payments` | Stripe intents, webhooks, refunds |
| Uploads | `src/modules/uploads` | S3 |
| Mail / Redis | `src/modules/mail`, `src/modules/redis` | Templates + cache invalidation |

## Logging

The API uses a Nest logger that writes **pretty lines in development** and **JSON to stdout/stderr in production** (CloudWatch / ECS). Every request gets an `x-request-id` header; 4xx/5xx responses include `requestId`. Passwords and tokens are redacted.

```env
LOG_LEVEL=debug    # error | warn | info | debug | verbose
LOG_PRETTY=true    # false in production
```

Attach Chrome/VS Code to the debugger:

- Local: `npm run start:debug`
- Docker: `npm run start:debug:docker` (port `9229`, bound to `0.0.0.0`)

Health:

- `GET /health/live` — process is up
- `GET /health` — Postgres + Redis

## Docker

Infrastructure only (Postgres, Redis, Mailhog):

```bash
docker compose up -d
```

API in development with live reload and Node inspector on `9229`:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

Production-shaped stack (API + Next.js web + Postgres + Redis, JSON logs):

```bash
docker compose -f docker-compose.prod.yml up --build
```

AWS (ECR, ECS Fargate, RDS, ElastiCache, CloudWatch): see [deploy/aws/README.md](deploy/aws/README.md).

## Production notes

- The production Docker image runs as a non-root user and health-checks `/health/live`.
- Keep `DB_SYNC=false` and run migrations.
- Replace JWT secrets with 32+ character values.
- Put real Stripe live keys, S3 credentials, and SMTP behind your host secrets.
