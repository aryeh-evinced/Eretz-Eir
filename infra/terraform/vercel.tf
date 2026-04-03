provider "vercel" {
  api_token = var.vercel_api_token
  team      = var.vercel_team_id != "" ? var.vercel_team_id : null
}

resource "vercel_project" "main" {
  name      = "${var.project_name_prefix}-${var.environment}"
  framework = "nextjs"

  git_repository = {
    type = "github"
    repo = "Lahav/Eretz-Eir"
  }
}

resource "vercel_project_environment_variable" "supabase_url" {
  project_id = vercel_project.main.id
  key        = "NEXT_PUBLIC_SUPABASE_URL"
  value      = "https://${supabase_project.main.id}.supabase.co"
  target     = ["production", "preview"]
}

resource "vercel_project_environment_variable" "supabase_anon_key" {
  project_id = vercel_project.main.id
  key        = "NEXT_PUBLIC_SUPABASE_ANON_KEY"
  # Retrieve from Supabase project after provisioning — set manually or via CI
  value  = "REPLACE_WITH_ANON_KEY"
  target = ["production", "preview"]
  sensitive = true
}

resource "vercel_project_environment_variable" "supabase_service_role_key" {
  project_id = vercel_project.main.id
  key        = "SUPABASE_SERVICE_ROLE_KEY"
  # Server-only — never exposed to the browser
  value  = "REPLACE_WITH_SERVICE_ROLE_KEY"
  target = ["production"]
  sensitive = true
}

resource "vercel_project_environment_variable" "app_base_url" {
  project_id = vercel_project.main.id
  key        = "NEXT_PUBLIC_APP_BASE_URL"
  value      = vercel_project.main.id != "" ? "https://${var.project_name_prefix}-${var.environment}.vercel.app" : ""
  target     = ["production", "preview"]
}

resource "vercel_project_environment_variable" "feature_multiplayer" {
  project_id = vercel_project.main.id
  key        = "FEATURE_MULTIPLAYER_ENABLED"
  value      = var.environment == "production" ? "true" : "true"
  target     = ["production", "preview"]
}

resource "vercel_project_environment_variable" "feature_ai" {
  project_id = vercel_project.main.id
  key        = "FEATURE_AI_ENABLED"
  value      = "true"
  target     = ["production", "preview"]
}
