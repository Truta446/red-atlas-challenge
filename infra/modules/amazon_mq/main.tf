variable "name" { type = string }
variable "subnets" { type = list(string) }
variable "security_group" { type = string }
variable "users" {
  type = list(object({
    username       = string
    password_ssm_name = string # nombre del parámetro SSM con la contraseña
  }))
}

# Whether the broker should be publicly accessible
variable "publicly_accessible" {
  type    = bool
  default = false
}

# Recupera contraseñas desde SSM Parameter Store (SecureString)
data "aws_ssm_parameter" "user_pw" {
  for_each = { for u in var.users : u.username => u.password_ssm_name }
  name     = each.value
  with_decryption = true
}

resource "aws_mq_broker" "this" {
  broker_name        = "${var.name}-mq"
  engine_type        = "RabbitMQ"
  engine_version     = "3.13"
  auto_minor_version_upgrade = true
  host_instance_type = "mq.t3.micro"
  publicly_accessible = var.publicly_accessible
  deployment_mode    = "SINGLE_INSTANCE"
  # When publicly_accessible=true, security_groups must not be specified
  security_groups    = var.publicly_accessible ? null : [var.security_group]
  # SINGLE_INSTANCE requiere exactamente 1 subnet
  subnet_ids         = [var.subnets[0]]

  dynamic "user" {
    for_each = var.users
    content {
      username = user.value.username
      password = data.aws_ssm_parameter.user_pw[user.value.username].value
    }
  }
}

output "amqp_endpoint" { value = aws_mq_broker.this.instances[0].endpoints[0] }
