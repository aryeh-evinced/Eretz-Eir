variable "environment" {
  description = "Deployment environment (staging or production)"
  type        = string

  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "environment must be 'staging' or 'production'."
  }
}

variable "supabase_access_token" {
  description = "Supabase personal access token (sbp_...)"
  type        = string
  sensitive   = true
}

variable "supabase_organization_id" {
  description = "Supabase organization ID"
  type        = string
}

variable "supabase_db_password" {
  description = "Postgres database password for the Supabase project"
  type        = string
  sensitive   = true

  validation {
    condition     = length(var.supabase_db_password) >= 16
    error_message = "Database password must be at least 16 characters."
  }
}

variable "vercel_api_token" {
  description = "Vercel API token"
  type        = string
  sensitive   = true
}

variable "vercel_team_id" {
  description = "Vercel team ID (optional, for team-owned projects)"
  type        = string
  default     = ""
}

variable "supabase_region" {
  description = "Supabase project region"
  type        = string
  default     = "eu-central-1"
}

variable "project_name_prefix" {
  description = "Prefix for all provisioned resource names"
  type        = string
  default     = "eretz-eir"
}
