output "alb_dns_name" { value = module.alb.alb_dns_name }
output "alb_domain" { value = module.alb.domain_fqdn }
output "rds_endpoint" { value = module.rds.endpoint }
output "redis_endpoint" { value = module.elasticache.endpoint }
output "mq_amqp_endpoint" { value = module.mq.amqp_endpoint }
