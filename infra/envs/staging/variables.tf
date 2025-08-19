variable "region" { type = string }
variable "project" { type = string }
variable "env" { type = string }
variable "domain" { type = string }
variable "route53_zone_id" { type = string }

# Credentials/secrets (pueden venir de SSM/Secrets Manager en una iteración siguiente)
variable "db_username" { type = string }
variable "db_password" { type = string }
