variable "name" { type = string }
variable "database_url" { type = string }

resource "aws_secretsmanager_secret" "db" {
  name = "${var.name}/database_url"
}

resource "aws_secretsmanager_secret_version" "db_v" {
  secret_id     = aws_secretsmanager_secret.db.id
  secret_string = var.database_url
}

output "database_url_arn" { value = aws_secretsmanager_secret.db.arn }
