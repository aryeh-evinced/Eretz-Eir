provider "supabase" {
  access_token = var.supabase_access_token
}

resource "supabase_project" "main" {
  organization_id   = var.supabase_organization_id
  name              = "${var.project_name_prefix}-${var.environment}"
  database_password = var.supabase_db_password
  region            = var.supabase_region

  lifecycle {
    # Prevent accidental deletion of the production database
    prevent_destroy = true
  }
}

# Edge Function environment settings are managed via the Supabase dashboard
# or supabase CLI (`supabase secrets set`). They are NOT stored in Terraform
# state to avoid leaking secrets.
#
# Required secrets (set via `supabase secrets set --env-file .env.production`):
#   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY, OPENAI_API_KEY
