output "eks_cluster_name" {
  value       = aws_eks_cluster.agentchain_cluster.name
  description = "EKS Cluster Name"
}

output "eks_cluster_endpoint" {
  value       = aws_eks_cluster.agentchain_cluster.endpoint
  description = "EKS API Server Endpoint"
}

output "aurora_postgres_endpoint" {
  value       = aws_rds_cluster.aurora_postgres.endpoint
  description = "Aurora PostgreSQL Cluster Endpoint"
}

output "redis_endpoint" {
  value       = aws_elasticache_cluster.redis_cache.cache_nodes[0].address
  description = "Redis Cache Cluster Endpoint"
}

output "s3_artifacts_bucket" {
  value       = aws_s3_bucket.artifacts_bucket.bucket
  description = "S3 Artifacts Bucket Name"
}
