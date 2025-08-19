variable "name" { type = string }
variable "public_subnets" { type = list(string) }
variable "security_group_id" { type = string }
variable "container_port" { type = number }
variable "container_healthcheck_path" {
  type    = string
  default = "/health"
}
variable "image" { type = string }
variable "desired_count" { type = number }
variable "task_execution_role_arn" { type = string }
variable "task_role_arn" { type = string }
variable "log_group_name" { type = string }
variable "alb_target_group_arn" { type = string }
variable "env_vars" { type = map(string) }
variable "secrets" {
  type    = map(string)
  default = {}
}

# Worker opcional (sin LB)
variable "worker_enabled" {
  type    = bool
  default = true
}

variable "worker_desired_count" {
  type    = number
  default = 1
}

variable "worker_command" {
  type    = list(string)
  default = ["npm", "run", "start:worker:imports:prod"]
}

# AutoScaling por CPU y RequestCount
variable "min_capacity" {
  type    = number
  default = 1
}

variable "max_capacity" {
  type    = number
  default = 3
}

variable "target_cpu_utilization" {
  type    = number
  default = 60
}

variable "enable_request_count_scaling" {
  type    = bool
  default = true
}

variable "request_count_per_target" {
  type    = number
  default = 50
}
variable "alb_request_count_resource_label" { type = string }

resource "aws_ecs_cluster" "this" {
  name = var.name
}

# Task definition
resource "aws_ecs_task_definition" "api" {
  family                   = "${var.name}-task"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "512"
  memory                   = "1024"
  execution_role_arn       = var.task_execution_role_arn
  task_role_arn            = var.task_role_arn

  container_definitions = jsonencode([
    {
      name      = "api"
      image     = var.image
      essential = true
      portMappings = [{ containerPort = var.container_port, protocol = "tcp" }]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = var.log_group_name
          awslogs-region        = data.aws_region.current.name
          awslogs-stream-prefix = "api"
        }
      }
      healthCheck = {
        command     = ["CMD-SHELL", "curl -fsS http://localhost:${var.container_port}${var.container_healthcheck_path} || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 10
      }
      environment = [for k, v in var.env_vars : { name = k, value = v }]
      secrets     = [for k, v in var.secrets  : { name = k, valueFrom = v }]
    }
  ])
}

data "aws_region" "current" {}

resource "aws_ecs_service" "api" {
  name            = "${var.name}-svc"
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.api.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets         = var.public_subnets # sin NAT: asignamos IP pública
    assign_public_ip = true
    security_groups = [var.security_group_id]
  }

  load_balancer {
    target_group_arn = var.alb_target_group_arn
    container_name   = "api"
    container_port   = var.container_port
  }

  lifecycle { ignore_changes = [desired_count] }
}

output "cluster_name" { value = aws_ecs_cluster.this.name }

# Worker TaskDefinition
resource "aws_ecs_task_definition" "worker" {
  count                    = var.worker_enabled ? 1 : 0
  family                   = "${var.name}-worker"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = var.task_execution_role_arn
  task_role_arn            = var.task_role_arn

  container_definitions = jsonencode([
    {
      name      = "worker"
      image     = var.image
      essential = true
      command   = var.worker_command
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = var.log_group_name
          awslogs-region        = data.aws_region.current.name
          awslogs-stream-prefix = "worker"
        }
      }
      environment = [for k, v in var.env_vars : { name = k, value = v }]
      secrets     = [for k, v in var.secrets  : { name = k, valueFrom = v }]
    }
  ])
}

# Servicio Worker (sin LB)
resource "aws_ecs_service" "worker" {
  count           = var.worker_enabled ? 1 : 0
  name            = "${var.name}-worker"
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.worker[0].arn
  desired_count   = var.worker_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.public_subnets
    assign_public_ip = true
    security_groups  = [var.security_group_id]
  }

  lifecycle { ignore_changes = [desired_count] }
}

# AutoScaling API por CPU
resource "aws_appautoscaling_target" "api" {
  max_capacity       = var.max_capacity
  min_capacity       = var.min_capacity
  resource_id        = "service/${aws_ecs_cluster.this.name}/${aws_ecs_service.api.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "api_cpu" {
  name               = "${var.name}-cpu"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.api.resource_id
  scalable_dimension = aws_appautoscaling_target.api.scalable_dimension
  service_namespace  = aws_appautoscaling_target.api.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value       = var.target_cpu_utilization
    scale_in_cooldown  = 60
    scale_out_cooldown = 60
  }
}

# AutoScaling API por RequestCount del ALB
resource "aws_appautoscaling_policy" "api_req" {
  count              = var.enable_request_count_scaling ? 1 : 0
  name               = "${var.name}-req"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.api.resource_id
  scalable_dimension = aws_appautoscaling_target.api.scalable_dimension
  service_namespace  = aws_appautoscaling_target.api.service_namespace

  target_tracking_scaling_policy_configuration {
    customized_metric_specification {
      metric_name = "RequestCountPerTarget"
      namespace   = "AWS/ApplicationELB"
      statistic   = "Sum"
      dimensions {
        name  = "TargetGroup"
        value = split("/", var.alb_request_count_resource_label)[5]
      }
      dimensions {
        name  = "LoadBalancer"
        value = "app/${split("/", var.alb_request_count_resource_label)[1]}/${split("/", var.alb_request_count_resource_label)[2]}"
      }
    }
    target_value       = var.request_count_per_target
    scale_in_cooldown  = 60
    scale_out_cooldown = 60
  }
}
