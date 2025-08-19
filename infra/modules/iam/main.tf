# Log group
resource "aws_cloudwatch_log_group" "api" {
  name              = "/ecs/api"
  retention_in_days = 14
}

# ECS task execution role
resource "aws_iam_role" "task_exec" {
  name_prefix        = "ecsTaskExecutionRole-"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume.json
}

data "aws_iam_policy_document" "ecs_tasks_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role_policy_attachment" "task_exec_attach" {
  role       = aws_iam_role.task_exec.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Permiso adicional para que la task execution role lea Secrets Manager
resource "aws_iam_role_policy" "task_exec_secrets" {
  name = "ecsTaskExecSecretsAccess"
  role = aws_iam_role.task_exec.id
  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      { Effect = "Allow", Action = ["secretsmanager:GetSecretValue"], Resource = "*" },
      { Effect = "Allow", Action = ["ssm:GetParameter", "ssm:GetParameters"], Resource = "*" }
    ]
  })
}

# Task role (permite leer SSM/Secrets si se necesita)
resource "aws_iam_role" "task" {
  name_prefix        = "ecsTaskRole-"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume.json
}

resource "aws_iam_role_policy" "task_extra" {
  name = "ecsTaskExtra"
  role = aws_iam_role.task.id
  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      { Effect = "Allow", Action = ["ssm:GetParameter", "ssm:GetParameters"], Resource = "*" },
      { Effect = "Allow", Action = ["secretsmanager:GetSecretValue"], Resource = "*" }
    ]
  })
}

output "task_exec_role_arn" { value = aws_iam_role.task_exec.arn }
output "task_role_arn"      { value = aws_iam_role.task.arn }
output "log_group_name"     { value = aws_cloudwatch_log_group.api.name }
