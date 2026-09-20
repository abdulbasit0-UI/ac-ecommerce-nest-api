# Deploy AC Commerce to AWS

The API emits **one JSON log line per event** in production (`LOG_PRETTY=false`). That is what CloudWatch, ECS, and most log aggregators expect.

Health:

- `GET /health/live` — process is up (use this for container health checks)
- `GET /health` — Postgres + Redis

## Suggested architecture

| Piece | AWS service |
| --- | --- |
| API + web containers | ECS Fargate behind an Application Load Balancer |
| Images | Elastic Container Registry |
| Postgres | RDS PostgreSQL |
| Redis | ElastiCache |
| Product images | S3 (+ CloudFront) |
| Secrets | SSM Parameter Store or Secrets Manager |
| Logs | CloudWatch Logs (`awslogs` driver) |
| Email | SES SMTP (`MAIL_HOST=email-smtp.<region>.amazonaws.com`) |

Do **not** run the compose Postgres/Redis containers as your production database on AWS. Point `DB_HOST` and `REDIS_HOST` at RDS and ElastiCache.

## Build and push images

From the API repo:

```bash
aws ecr create-repository --repository-name ac-commerce-api
docker build --target production -t ac-commerce-api .
docker tag ac-commerce-api:latest ACCOUNT_ID.dkr.ecr.REGION.amazonaws.com/ac-commerce-api:latest
aws ecr get-login-password --region REGION | docker login --username AWS --password-stdin ACCOUNT_ID.dkr.ecr.REGION.amazonaws.com
docker push ACCOUNT_ID.dkr.ecr.REGION.amazonaws.com/ac-commerce-api:latest
```

From `../ac-commerce-web`:

```bash
aws ecr create-repository --repository-name ac-commerce-web
docker build --build-arg NEXT_PUBLIC_API_URL=https://api.example.com/api/v1 --build-arg NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_... -t ac-commerce-web .
docker tag ac-commerce-web:latest ACCOUNT_ID.dkr.ecr.REGION.amazonaws.com/ac-commerce-web:latest
docker push ACCOUNT_ID.dkr.ecr.REGION.amazonaws.com/ac-commerce-web:latest
```

`NEXT_PUBLIC_*` values are baked in at **image build** time. Rebuild the web image if the public API URL or Stripe publishable key changes.

## Register the task definitions

1. Create log groups `/ecs/ac-commerce-api` and `/ecs/ac-commerce-web`.
2. Replace `ACCOUNT_ID` and `REGION` in `ecs-task-definition.api.json` and `ecs-task-definition.web.json`.
3. Put secrets in SSM (`/ac-commerce/...`).
4. Register:

```bash
aws ecs register-task-definition --cli-input-json file://deploy/aws/ecs-task-definition.api.json
aws ecs register-task-definition --cli-input-json file://deploy/aws/ecs-task-definition.web.json
```

5. Create an ECS cluster and two Fargate services, each with an ALB target group:
   - API: port 3000, health check `/health/live`
   - Web: port 3001, health check `/`

Give the API task role `s3:PutObject`, `s3:DeleteObject`, and `s3:GetObject` on the media bucket.

Stripe webhooks should hit `https://api.example.com/api/v1/payments/webhooks/stripe`.

## Local production-shaped run

This starts API + web + Postgres + Redis with JSON logs (not a substitute for RDS on AWS):

```bash
docker compose -f docker-compose.prod.yml up --build
```
