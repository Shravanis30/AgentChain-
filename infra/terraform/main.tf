# AgentChain Enterprise Cloud Infrastructure (Terraform)
terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# 1. VPC & Networking
resource "aws_vpc" "agentchain_vpc" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name        = "agentchain-enterprise-vpc"
    Environment = var.environment
  }
}

# 2. EKS Kubernetes Cluster
resource "aws_eks_cluster" "agentchain_cluster" {
  name     = "agentchain-eks-${var.environment}"
  role_arn = aws_iam_role.eks_cluster_role.arn
  version  = "1.30"

  vpc_config {
    subnet_ids = aws_subnet.private_subnets[*].id
  }

  depends_on = [
    aws_iam_role_policy_attachment.eks_cluster_policy
  ]
}

# 3. AWS Aurora PostgreSQL (Multi-AZ)
resource "aws_rds_cluster" "aurora_postgres" {
  cluster_identifier      = "agentchain-aurora-${var.environment}"
  engine                  = "aurora-postgresql"
  engine_version          = "16.1"
  database_name           = "agentchain_db"
  master_username         = var.db_username
  master_password         = var.db_password
  backup_retention_period = 14
  preferred_backup_window = "02:00-03:00"
  storage_encrypted       = true
  deletion_protection     = true

  vpc_security_group_ids = [aws_security_group.db_sg.id]
}

# 4. AWS ElastiCache Redis Cluster
resource "aws_elasticache_cluster" "redis_cache" {
  cluster_id           = "agentchain-redis-${var.environment}"
  engine               = "redis"
  node_type            = "cache.t4g.medium"
  num_cache_nodes      = 1
  parameter_group_name = "default.redis7"
  port                 = 6379
  security_group_ids   = [aws_security_group.redis_sg.id]
}

# 5. Encrypted S3 Bucket for Task Artifacts
resource "aws_s3_bucket" "artifacts_bucket" {
  bucket = "agentchain-artifacts-${var.environment}-${var.aws_region}"
}

resource "aws_s3_bucket_server_side_encryption_configuration" "s3_enc" {
  bucket = aws_s3_bucket.artifacts_bucket.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Basic IAM Roles & SGs
resource "aws_iam_role" "eks_cluster_role" {
  name = "agentchain-eks-cluster-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "eks.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "eks_cluster_policy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy"
  role       = aws_iam_role.eks_cluster_role.name
}

resource "aws_subnet" "private_subnets" {
  count             = 2
  vpc_id            = aws_vpc.agentchain_vpc.id
  cidr_block        = "10.0.${count.index + 1}.0/24"
  availability_zone = "${var.aws_region}${count.index == 0 ? "a" : "b"}"

  tags = {
    Name = "agentchain-private-subnet-${count.index + 1}"
  }
}

resource "aws_security_group" "db_sg" {
  name        = "agentchain-db-sg"
  description = "Allow PostgreSQL inbound from EKS pods"
  vpc_id      = aws_vpc.agentchain_vpc.id

  ingress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "redis_sg" {
  name        = "agentchain-redis-sg"
  description = "Allow Redis inbound from EKS pods"
  vpc_id      = aws_vpc.agentchain_vpc.id

  ingress {
    from_port   = 6379
    to_port     = 6379
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}
