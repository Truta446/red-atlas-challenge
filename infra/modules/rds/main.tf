variable "name" { type = string }
variable "subnets" { type = list(string) }
variable "vpc_security_groups" { type = list(string) }
variable "db_username" { type = string }
variable "db_password" { type = string }

# Whether the RDS instance should be publicly accessible
variable "publicly_accessible" {
  type    = bool
  default = false
}

# Optional explicit name for the DB Subnet Group (useful to force a new one)
variable "subnet_group_name" {
  type    = string
  default = null
}

resource "aws_db_subnet_group" "this" {
  name       = coalesce(var.subnet_group_name, "${var.name}-db-subnets")
  subnet_ids = var.subnets

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_db_instance" "this" {
  identifier              = "${var.name}-pg"
  engine                  = "postgres"
  engine_version          = "16"
  instance_class          = "db.t4g.micro" # económico
  allocated_storage       = 20
  username                = var.db_username
  password                = var.db_password
  db_subnet_group_name    = aws_db_subnet_group.this.name
  vpc_security_group_ids  = var.vpc_security_groups
  publicly_accessible     = var.publicly_accessible
  skip_final_snapshot     = true
  multi_az                = false
  storage_encrypted       = true
}

output "endpoint" { value = aws_db_instance.this.address }
output "jdbc_url" { value = "postgresql://${aws_db_instance.this.address}:5432/postgres" }
