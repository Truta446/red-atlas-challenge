variable "vpc_id" { type = string }

# Optional admin CIDRs allowed to access DB/MQ directly (e.g., your public IP /32)
variable "admin_cidrs" {
  type    = list(string)
  default = []
}

# ALB SG (ingress 80/443 desde internet)
resource "aws_security_group" "alb" {
  name        = "alb-sg"
  description = "ALB"
  vpc_id      = var.vpc_id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# ECS SG (solo tráfico desde ALB al puerto app)
variable "app_port" { type = number }
resource "aws_security_group" "ecs" {
  name        = "ecs-sg"
  description = "ECS service"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = var.app_port
    to_port         = var.app_port
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# DB SG
resource "aws_security_group" "db" {
  name        = "db-sg"
  description = "RDS"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs.id]
  }

  # Optional direct admin access to Postgres from specified CIDRs
  ingress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = var.admin_cidrs
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# Redis SG
resource "aws_security_group" "redis" {
  name        = "redis-sg"
  description = "ElastiCache"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# MQ SG
resource "aws_security_group" "mq" {
  name        = "mq-sg"
  description = "Amazon MQ"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = 5671
    to_port         = 5672
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs.id]
  }

  ingress {
    from_port       = 8162
    to_port         = 8162
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs.id]
  }

  # Optional direct admin access to AMQP/S and console from specified CIDRs
  ingress {
    from_port   = 5671
    to_port     = 5672
    protocol    = "tcp"
    cidr_blocks = var.admin_cidrs
  }

  ingress {
    from_port   = 8162
    to_port     = 8162
    protocol    = "tcp"
    cidr_blocks = var.admin_cidrs
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

output "alb_sg_id"   { value = aws_security_group.alb.id }
output "ecs_sg_id"   { value = aws_security_group.ecs.id }
output "db_sg_id"    { value = aws_security_group.db.id }
output "redis_sg_id" { value = aws_security_group.redis.id }
output "mq_sg_id"    { value = aws_security_group.mq.id }
