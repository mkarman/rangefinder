# RangeFinder — AWS Deployment Guide

## Architecture Overview

```
Internet
    │ HTTPS 443
    ▼
┌─────────────────────────────────────────────────────┐
│  AWS Application Load Balancer (ALB)                │
│  - TLS termination (ACM certificate)                │
│  - Routes to ECS target group                       │
└──────────────────────┬──────────────────────────────┘
                       │ HTTP 3000
                       ▼
┌─────────────────────────────────────────────────────┐
│  ECS Fargate Cluster                                │
│  ┌─────────────────────────────────────────────┐   │
│  │  Task: rangefinder                          │   │
│  │  Container: rangefinder (ECR image)         │   │
│  │  CPU: 256  Memory: 512 MB                   │   │
│  │  Port: 3000                                 │   │
│  └─────────────────────────────────────────────┘   │
│  Public subnet (needs internet for SES calls)       │
└──────────┬──────────────────────┬───────────────────┘
           │                      │
           ▼                      ▼
┌──────────────────┐   ┌──────────────────────────────┐
│  RDS PostgreSQL  │   │  AWS SES                     │
│  db.t3.micro     │   │  Region: us-east-1           │
│  Private subnet  │   │  Verified: rangefinder.aero  │
│  Port: 5432      │   │  From: noreply@rangefinder.aero│
└──────────────────┘   └──────────────────────────────┘
           │
           ▼
┌──────────────────┐
│  Secrets Manager │
│  - DATABASE_URL  │
│  - SES creds     │
└──────────────────┘
```

---

## Prerequisites

- AWS CLI configured (`aws configure`)
- Docker Desktop installed and running
- Domain `rangefinder.aero` with DNS access (for ACM + SES verification)
- AWS account with permissions for: ECR, ECS, RDS, SES, ALB, ACM, Secrets Manager, IAM, VPC

---

## Step 1 — SES Domain Verification

Before deploying, verify the sending domain in SES so emails can be sent.

```bash
# Request domain identity verification
aws ses verify-domain-identity \
  --domain rangefinder.aero \
  --region us-east-1

# Add the returned TXT record to your DNS provider
# Then verify DKIM:
aws ses verify-domain-dkim \
  --domain rangefinder.aero \
  --region us-east-1
# Add the 3 CNAME records returned to DNS

# Move out of SES sandbox (required to send to unverified addresses):
# AWS Console → SES → Account dashboard → Request production access
# Fill in the form explaining the use case (transactional notifications)
```

---

## Step 2 — ECR Repository & Push Image

```bash
# Set variables
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION=us-east-1
ECR_REPO=rangefinder

# Create ECR repository (one-time)
aws ecr create-repository \
  --repository-name $ECR_REPO \
  --region $AWS_REGION

# Authenticate Docker to ECR
aws ecr get-login-password --region $AWS_REGION \
  | docker login --username AWS \
    --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

# Build and push
docker build -t $ECR_REPO .
docker tag $ECR_REPO:latest \
  $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO:latest
docker push \
  $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO:latest
```

---

## Step 3 — Secrets Manager

Store sensitive values so they are never in the task definition or source code.

```bash
# Store the full DATABASE_URL (fill in real RDS endpoint after Step 4)
aws secretsmanager create-secret \
  --name rangefinder/DATABASE_URL \
  --secret-string "postgres://rangefinder:STRONG_PASSWORD@YOUR_RDS_ENDPOINT:5432/rangefinder" \
  --region $AWS_REGION

# Store SES credentials (or use an IAM role — preferred, see note below)
aws secretsmanager create-secret \
  --name rangefinder/SES_FROM_ADDRESS \
  --secret-string "noreply@rangefinder.aero" \
  --region $AWS_REGION
```

> **Preferred:** Attach an IAM role to the ECS task with `ses:SendEmail` permission
> instead of storing AWS credentials. The SDK will pick up the role automatically.
> See the IAM section below.

---

## Step 4 — RDS PostgreSQL

```bash
# Create a DB subnet group (use private subnets from your VPC)
aws rds create-db-subnet-group \
  --db-subnet-group-name rangefinder-subnet-group \
  --db-subnet-group-description "RangeFinder RDS subnet group" \
  --subnet-ids subnet-XXXXXXXX subnet-YYYYYYYY

# Create the RDS instance
aws rds create-db-instance \
  --db-instance-identifier rangefinder-db \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --engine-version 16 \
  --master-username rangefinder \
  --master-user-password STRONG_PASSWORD \
  --db-name rangefinder \
  --db-subnet-group-name rangefinder-subnet-group \
  --vpc-security-group-ids sg-XXXXXXXX \
  --no-publicly-accessible \
  --storage-type gp3 \
  --allocated-storage 20 \
  --backup-retention-period 7 \
  --region $AWS_REGION

# Wait for the instance to be available (~5 min)
aws rds wait db-instance-available \
  --db-instance-identifier rangefinder-db

# Get the endpoint
aws rds describe-db-instances \
  --db-instance-identifier rangefinder-db \
  --query 'DBInstances[0].Endpoint.Address' \
  --output text
```

Update the `rangefinder/DATABASE_URL` secret with the real endpoint.

---

## Step 5 — IAM Task Role

```bash
# Create task execution role (allows ECS to pull from ECR + write logs)
aws iam create-role \
  --role-name rangefinder-task-execution-role \
  --assume-role-policy-document '{
    "Version":"2012-10-17",
    "Statement":[{
      "Effect":"Allow",
      "Principal":{"Service":"ecs-tasks.amazonaws.com"},
      "Action":"sts:AssumeRole"
    }]
  }'

aws iam attach-role-policy \
  --role-name rangefinder-task-execution-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy

# Create task role (allows the app to call SES + read Secrets Manager)
aws iam create-role \
  --role-name rangefinder-task-role \
  --assume-role-policy-document '{
    "Version":"2012-10-17",
    "Statement":[{
      "Effect":"Allow",
      "Principal":{"Service":"ecs-tasks.amazonaws.com"},
      "Action":"sts:AssumeRole"
    }]
  }'

aws iam put-role-policy \
  --role-name rangefinder-task-role \
  --policy-name rangefinder-app-policy \
  --policy-document '{
    "Version":"2012-10-17",
    "Statement":[
      {
        "Effect":"Allow",
        "Action":["ses:SendEmail","ses:SendRawEmail"],
        "Resource":"*"
      },
      {
        "Effect":"Allow",
        "Action":["secretsmanager:GetSecretValue"],
        "Resource":"arn:aws:secretsmanager:us-east-1:*:secret:rangefinder/*"
      }
    ]
  }'
```

---

## Step 6 — ECS Cluster & Task Definition

```bash
# Create cluster
aws ecs create-cluster \
  --cluster-name rangefinder \
  --region $AWS_REGION

# Register task definition (save as task-definition.json first — see below)
aws ecs register-task-definition \
  --cli-input-json file://plans/task-definition.json \
  --region $AWS_REGION
```

### `plans/task-definition.json` (template)

```json
{
  "family": "rangefinder",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "executionRoleArn": "arn:aws:iam::ACCOUNT_ID:role/rangefinder-task-execution-role",
  "taskRoleArn":      "arn:aws:iam::ACCOUNT_ID:role/rangefinder-task-role",
  "containerDefinitions": [
    {
      "name": "rangefinder",
      "image": "ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/rangefinder:latest",
      "portMappings": [{ "containerPort": 3000, "protocol": "tcp" }],
      "essential": true,
      "environment": [
        { "name": "NODE_ENV",        "value": "production" },
        { "name": "EMAIL_PROVIDER",  "value": "ses" },
        { "name": "AWS_REGION",      "value": "us-east-1" },
        { "name": "SES_FROM_ADDRESS","value": "noreply@rangefinder.aero" },
        { "name": "NOTIFY_EMAIL",    "value": "karman@strategicmissionelements.com" }
      ],
      "secrets": [
        {
          "name": "DATABASE_URL",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:ACCOUNT_ID:secret:rangefinder/DATABASE_URL"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group":         "/ecs/rangefinder",
          "awslogs-region":        "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command":     ["CMD-SHELL", "wget -qO- http://localhost:3000/health || exit 1"],
        "interval":    30,
        "timeout":     5,
        "retries":     3,
        "startPeriod": 15
      }
    }
  ]
}
```

---

## Step 7 — ALB + ECS Service

```bash
# Create ALB target group
aws elbv2 create-target-group \
  --name rangefinder-tg \
  --protocol HTTP \
  --port 3000 \
  --vpc-id vpc-XXXXXXXX \
  --target-type ip \
  --health-check-path /health \
  --health-check-interval-seconds 30

# Create ALB (public subnets)
aws elbv2 create-load-balancer \
  --name rangefinder-alb \
  --subnets subnet-PUBLIC1 subnet-PUBLIC2 \
  --security-groups sg-ALB \
  --scheme internet-facing \
  --type application

# Create HTTPS listener (requires ACM certificate)
aws elbv2 create-listener \
  --load-balancer-arn ALB_ARN \
  --protocol HTTPS \
  --port 443 \
  --certificates CertificateArn=ACM_CERT_ARN \
  --default-actions Type=forward,TargetGroupArn=TG_ARN

# Create ECS service
aws ecs create-service \
  --cluster rangefinder \
  --service-name rangefinder \
  --task-definition rangefinder \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={
    subnets=[subnet-PUBLIC1,subnet-PUBLIC2],
    securityGroups=[sg-APP],
    assignPublicIp=ENABLED
  }" \
  --load-balancers "targetGroupArn=TG_ARN,containerName=rangefinder,containerPort=3000" \
  --region $AWS_REGION
```

---

## Step 8 — Run DB Migrations in Production

After the service is running, exec into the task to run migrations once:

```bash
# Get the running task ARN
TASK_ARN=$(aws ecs list-tasks \
  --cluster rangefinder \
  --service-name rangefinder \
  --query 'taskArns[0]' \
  --output text)

# Run migrations via ECS Exec (requires enableExecuteCommand on the service)
aws ecs execute-command \
  --cluster rangefinder \
  --task $TASK_ARN \
  --container rangefinder \
  --interactive \
  --command "node server/db/migrate.js"
```

---

## Ongoing Deployments (CI/CD)

```bash
# Build, tag, push new image
docker build -t rangefinder .
docker tag rangefinder:latest $ECR_URI:latest
docker push $ECR_URI:latest

# Force ECS to pull the new image and restart tasks
aws ecs update-service \
  --cluster rangefinder \
  --service rangefinder \
  --force-new-deployment \
  --region $AWS_REGION
```

---

## Cost Estimate (minimal production setup)

| Service | Config | Est. Monthly |
|---|---|---|
| ECS Fargate | 256 CPU / 512 MB, 1 task | ~$8 |
| RDS PostgreSQL | db.t3.micro, 20 GB gp3 | ~$15 |
| ALB | 1 ALB, low traffic | ~$16 |
| SES | First 62,000 emails/month | Free |
| ECR | <1 GB storage | ~$0.10 |
| Secrets Manager | 2 secrets | ~$0.80 |
| **Total** | | **~$40/month** |

> Scale down RDS to `db.t3.micro` with single-AZ for dev/staging to reduce cost further.
> Use Fargate Spot for non-production environments (~70% discount).
