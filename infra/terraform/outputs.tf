output "supabase_project_id" {
  description = "Supabase project reference ID"
  value       = supabase_project.main.id
}

output "supabase_api_url" {
  description = "Supabase REST/Realtime API URL"
  value       = "https://${supabase_project.main.id}.supabase.co"
}

output "vercel_project_id" {
  description = "Vercel project ID"
  value       = vercel_project.main.id
}

output "vercel_deployment_url" {
  description = "Primary Vercel deployment URL"
  value       = "https://${var.project_name_prefix}-${var.environment}.vercel.app"
}
