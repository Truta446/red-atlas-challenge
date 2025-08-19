variable "name" { type = string }
variable "public_subnet_ids" { type = list(string) }
variable "security_group_id" { type = string }
variable "domain" { type = string }
variable "route53_zone_id" { type = string }
variable "target_port" { type = number }
variable "health_check_path" { type = string }

resource "aws_lb" "this" {
  name               = var.name
  load_balancer_type = "application"
  subnets            = var.public_subnet_ids
  security_groups    = [var.security_group_id]
}

resource "aws_lb_target_group" "api" {
  name_prefix = "tgapi-"
  port     = var.target_port
  protocol = "HTTP"
  vpc_id   = data.aws_vpc.selected.id
  target_type = "ip"

  health_check {
    path    = var.health_check_path
    matcher = "200-399"
  }

  lifecycle {
    create_before_destroy = true
  }
}

data "aws_vpc" "selected" {
  id = aws_lb.this.vpc_id
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.this.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"

    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

# Para HTTPS, el ALB usa un certificado de ACM ya existente en la misma región
variable "certificate_arn" { type = string }
resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.this.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-2016-08"
  certificate_arn   = var.certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }
}

# Registro DNS A/AAAA apuntando al ALB
resource "aws_route53_record" "api" {
  zone_id = var.route53_zone_id
  name    = var.domain
  type    = "A"
  alias {
    name                   = aws_lb.this.dns_name
    zone_id                = aws_lb.this.zone_id
    evaluate_target_health = true
  }
}

output "alb_dns_name"  { value = aws_lb.this.dns_name }
output "http_listener_arn" { value = aws_lb_listener.http.arn }
output "https_listener_arn" { value = aws_lb_listener.https.arn }
output "target_group_arn" { value = aws_lb_target_group.api.arn }
output "domain_fqdn" { value = aws_route53_record.api.fqdn }
output "request_count_resource_label" {
  value = "app/${aws_lb.this.name}/${aws_lb.this.arn_suffix}/targetgroup/${aws_lb_target_group.api.name}/${aws_lb_target_group.api.arn_suffix}"
}
