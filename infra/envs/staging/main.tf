locals {
  name = "${var.project}-${var.env}"
}

module "vpc" {
  source     = "../../modules/vpc"
  name       = local.name
  cidr_block = "10.20.0.0/16"
  azs        = ["us-east-1a", "us-east-1b"]
}

module "security" {
  source  = "../../modules/security"
  vpc_id  = module.vpc.vpc_id
  app_port = 3000
  admin_cidrs = [
    "152.168.141.243/32",
  ]
}

module "ecr" {
  source = "../../modules/ecr"
  name   = "${var.project}-api"
}

module "iam" {
  source = "../../modules/iam"
}

module "alb" {
  source            = "../../modules/alb"
  name              = "${local.name}-alb"
  public_subnet_ids = module.vpc.public_subnet_ids
  security_group_id = module.security.alb_sg_id
  domain            = var.domain
  route53_zone_id   = var.route53_zone_id
  target_port       = 3000
  health_check_path = "/health"
  certificate_arn   = var.certificate_arn
}

# Base de datos económica Single-AZ
module "rds" {
  source              = "../../modules/rds"
  name                = local.name
  subnets             = module.vpc.public_subnet_ids
  vpc_security_groups = [module.security.db_sg_id]
  db_username         = var.db_username
  db_password         = var.db_password
  subnet_group_name   = "${local.name}-db-subnets-public"
  publicly_accessible = true
}

# Redis económico single-node
module "elasticache" {
  source         = "../../modules/elasticache"
  name           = local.name
  subnets        = module.vpc.private_subnet_ids
  security_group = module.security.redis_sg_id
  node_type      = "cache.t4g.micro"
}

# Amazon MQ for RabbitMQ Single-Instance
module "mq" {
  source         = "../../modules/amazon_mq"
  name           = local.name
  subnets        = module.vpc.public_subnet_ids
  security_group = module.security.mq_sg_id
  users = [{ username = "admin", password_ssm_name = "/${var.project}/${var.env}/mq/admin" }]
  publicly_accessible = true
}

locals {
  database_url = "postgresql://${var.db_username}:${var.db_password}@${module.rds.endpoint}:5432/postgres"
}

# Secrets Manager para DB URL
module "secrets" {
  source       = "../../modules/secrets"
  name         = local.name
  database_url = local.database_url
}

# ECS en subred pública (sin NAT), con IP pública, pero detrás del ALB
module "ecs" {
  source                 = "../../modules/ecs"
  name                   = local.name
  public_subnets         = module.vpc.public_subnet_ids
  security_group_id      = module.security.ecs_sg_id
  container_port         = 3000
  container_healthcheck_path = "/health"
  image                  = "${module.ecr.repository_url}:latest"
  desired_count          = 1
  task_execution_role_arn = module.iam.task_exec_role_arn
  task_role_arn           = module.iam.task_role_arn
  log_group_name          = module.iam.log_group_name
  alb_target_group_arn    = module.alb.target_group_arn
  env_vars = {
    REDIS_URL    = module.elasticache.redis_url
    # RabbitMQ: pasar host (sin credenciales) y usuario; la password va como secret
    RABBITMQ_HOST = module.mq.amqp_endpoint
    RABBITMQ_USER = "admin"
    NODE_ENV     = "production"
  }
  secrets = {
    DATABASE_URL = module.secrets.database_url_arn
    # Usa el SSM Parameter SecureString creado previamente: /red-atlas/staging/mq/admin
    RABBITMQ_PASSWORD = "/${var.project}/${var.env}/mq/admin"
  }
  # Worker
  worker_enabled       = true
  worker_desired_count = 1
  worker_command       = ["npm", "run", "start:worker:imports:prod"]

  # AutoScaling
  min_capacity                   = 1
  max_capacity                   = 3
  target_cpu_utilization         = 60
  enable_request_count_scaling   = true
  request_count_per_target       = 50
  alb_request_count_resource_label = module.alb.request_count_resource_label
}

variable "certificate_arn" { type = string }
