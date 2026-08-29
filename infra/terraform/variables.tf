variable "aws_region" {
  type        = string
  default     = "us-east-1"
  description = "Primary AWS region"
}

variable "environment" {
  type        = string
  default     = "production"
  description = "Target deployment environment"
}

variable "vpc_cidr" {
  type        = string
  default     = "10.0.0.0/16"
  description = "VPC CIDR block"
}

variable "db_username" {
  type        = string
  default     = "agentchain_admin"
  description = "Aurora PostgreSQL master username"
}

variable "db_password" {
  type        = string
  sensitive   = true
  description = "Aurora PostgreSQL master password (loaded from Secrets Manager)"
}
