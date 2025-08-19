variable "name" { type = string }
variable "subnets" { type = list(string) }
variable "security_group" { type = string }
variable "node_type" { type = string }

resource "aws_elasticache_subnet_group" "this" {
  name       = "${var.name}-redis-subnets"
  subnet_ids = var.subnets
}

# cluster single-node económico
resource "aws_elasticache_cluster" "this" {
  cluster_id           = "${var.name}-redis"
  engine               = "redis"
  node_type            = var.node_type
  num_cache_nodes      = 1
  parameter_group_name = "default.redis7"
  subnet_group_name    = aws_elasticache_subnet_group.this.name
  security_group_ids   = [var.security_group]
}

output "endpoint" { value = aws_elasticache_cluster.this.cache_nodes[0].address }
output "redis_url" { value = "redis://${aws_elasticache_cluster.this.cache_nodes[0].address}:6379" }
