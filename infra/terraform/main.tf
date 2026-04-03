terraform {
  required_version = ">= 1.5"

  required_providers {
    supabase = {
      source  = "supabase/supabase"
      version = "~> 1.0"
    }
    vercel = {
      source  = "vercel/vercel"
      version = "~> 1.0"
    }
  }

  # Remote state — configure one of the following backends before running.
  # Option A: Terraform Cloud / HCP Terraform
  # backend "remote" {
  #   organization = "your-org"
  #   workspaces {
  #     prefix = "eretz-eir-"   # eretz-eir-staging, eretz-eir-production
  #   }
  # }

  # Option B: S3 + DynamoDB (self-hosted)
  # backend "s3" {
  #   bucket         = "your-tfstate-bucket"
  #   key            = "eretz-eir/${var.environment}/terraform.tfstate"
  #   region         = "us-east-1"
  #   dynamodb_table = "terraform-locks"
  #   encrypt        = true
  # }
}
