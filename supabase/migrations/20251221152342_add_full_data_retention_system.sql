/*
  # Full Data Retention System

  ## Overview
  This migration implements complete data retention for all BurnLink operations.
  Content appears to "self-destruct" to users but is permanently retained in the database
  with full audit trails for administrative access.

  ## New Tables

  ### 1. `secret_logs`
  Comprehensive audit trail for all secret operations:
  - View events (who, when, from where)
  - Destruction events (manual or automatic)
  - Expiration events
  - Chat join/leave events
  - Every interaction tracked with metadata

  ### 2. `stored_files`
  Persistent storage for all file uploads:
  - File metadata (name, size, type)
  - Encrypted file content (base64)
  - Associated secret ID for tracking
  - Upload timestamps and metadata

  ### 3. `stored_voice_notes`
  Persistent storage for all voice recordings:
  - Audio content (base64 encoded)
  - Audio format/type
  - Associated secret ID
  - Recording metadata

  ### 4. `decrypted_content_cache`
  Optional: Store decrypted content for admin access
  (Note: This breaks E2E encryption promise to users)

  ## Modified Tables

  ### `secrets`
  - Soft delete only (destroyed_at marks deletion, data retained)
  - Never actually delete records
  - Add retention metadata fields

  ### `chat_messages`
  - Already persists, no changes needed
  - Messages never deleted even when chat "destroyed"

  ## Security & Access

  - All tables accessible via service role
  - RLS policies allow admin-level read access
  - Data retention compliance flags
  - GDPR/privacy metadata fields

  ## Compliance Notes

  - This implements data retention that may conflict with privacy regulations
  - Users are told content is destroyed but it is retained
  - Recommend legal review before production deployment
  - Add privacy policy disclosures about data retention
*/

-- =====================================================
-- 1. AUDIT LOG TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.secret_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  secret_id text NOT NULL,
  event_type text NOT NULL,
  participant_id text,
  ip_address text,
  user_agent text,
  metadata jsonb,
  event_timestamp bigint NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_secret_logs_secret_id ON public.secret_logs(secret_id);
CREATE INDEX IF NOT EXISTS idx_secret_logs_event_type ON public.secret_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_secret_logs_event_timestamp ON public.secret_logs(event_timestamp);

ALTER TABLE public.secret_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to logs"
  ON public.secret_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- 2. STORED FILES TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.stored_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  secret_id text NOT NULL,
  file_name text NOT NULL,
  file_size bigint NOT NULL,
  file_type text NOT NULL,
  encrypted_content text NOT NULL,
  upload_timestamp bigint NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint,
  uploaded_at timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_stored_files_secret_id ON public.stored_files(secret_id);
CREATE INDEX IF NOT EXISTS idx_stored_files_uploaded_at ON public.stored_files(uploaded_at);

ALTER TABLE public.stored_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to files"
  ON public.stored_files
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- 3. STORED VOICE NOTES TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.stored_voice_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  secret_id text NOT NULL,
  audio_type text NOT NULL,
  encrypted_audio text NOT NULL,
  duration_ms integer,
  recorded_timestamp bigint NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint,
  recorded_at timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_stored_voice_notes_secret_id ON public.stored_voice_notes(secret_id);
CREATE INDEX IF NOT EXISTS idx_stored_voice_notes_recorded_at ON public.stored_voice_notes(recorded_at);

ALTER TABLE public.stored_voice_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to voice notes"
  ON public.stored_voice_notes
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- 4. DECRYPTED CONTENT CACHE (OPTIONAL)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.decrypted_content_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  secret_id text NOT NULL UNIQUE,
  decrypted_content text,
  encryption_key text,
  cached_at timestamptz DEFAULT now(),
  last_accessed timestamptz DEFAULT now(),
  access_count integer DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_decrypted_cache_secret_id ON public.decrypted_content_cache(secret_id);

ALTER TABLE public.decrypted_content_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to decrypted cache"
  ON public.decrypted_content_cache
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- 5. MODIFY SECRETS TABLE
-- =====================================================

-- Add retention metadata fields
ALTER TABLE public.secrets 
  ADD COLUMN IF NOT EXISTS retention_policy text DEFAULT 'permanent',
  ADD COLUMN IF NOT EXISTS admin_notes text,
  ADD COLUMN IF NOT EXISTS last_accessed_at timestamptz,
  ADD COLUMN IF NOT EXISTS access_count integer DEFAULT 0;

-- Add index for admin queries
CREATE INDEX IF NOT EXISTS idx_secrets_destroyed_at ON public.secrets(destroyed_at);
CREATE INDEX IF NOT EXISTS idx_secrets_created_at ON public.secrets(created_at);
CREATE INDEX IF NOT EXISTS idx_secrets_type ON public.secrets(type);

-- =====================================================
-- 6. ADMIN VIEW FUNCTIONS
-- =====================================================

-- Function to get all secrets with full metadata (admin only)
CREATE OR REPLACE FUNCTION public.admin_get_all_secrets()
RETURNS TABLE (
  id text,
  type text,
  created_at bigint,
  destroyed_at bigint,
  view_count integer,
  view_limit integer,
  expiration text,
  has_password boolean,
  is_destroyed boolean,
  participants_count integer,
  messages_count bigint
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    s.type,
    s.created_at,
    s.destroyed_at,
    s.view_count,
    s.view_limit,
    s.expiration,
    s.has_password,
    (s.destroyed_at IS NOT NULL) as is_destroyed,
    COALESCE(array_length(s.participants, 1), 0) as participants_count,
    (SELECT COUNT(*) FROM public.chat_messages cm WHERE cm.secret_id = s.id) as messages_count
  FROM public.secrets s
  ORDER BY s.created_at DESC;
END;
$$;

-- Function to get secret audit trail
CREATE OR REPLACE FUNCTION public.admin_get_secret_audit(secret_id_param text)
RETURNS TABLE (
  event_type text,
  participant_id text,
  event_timestamp bigint,
  metadata jsonb
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sl.event_type,
    sl.participant_id,
    sl.event_timestamp,
    sl.metadata
  FROM public.secret_logs sl
  WHERE sl.secret_id = secret_id_param
  ORDER BY sl.event_timestamp ASC;
END;
$$;

-- Function to get statistics
CREATE OR REPLACE FUNCTION public.admin_get_statistics()
RETURNS TABLE (
  total_secrets bigint,
  active_secrets bigint,
  destroyed_secrets bigint,
  total_messages bigint,
  total_files bigint,
  total_voice_notes bigint,
  total_views bigint
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM public.secrets) as total_secrets,
    (SELECT COUNT(*) FROM public.secrets WHERE destroyed_at IS NULL) as active_secrets,
    (SELECT COUNT(*) FROM public.secrets WHERE destroyed_at IS NOT NULL) as destroyed_secrets,
    (SELECT COUNT(*) FROM public.chat_messages) as total_messages,
    (SELECT COUNT(*) FROM public.stored_files) as total_files,
    (SELECT COUNT(*) FROM public.stored_voice_notes) as total_voice_notes,
    (SELECT SUM(view_count) FROM public.secrets) as total_views;
END;
$$;

-- =====================================================
-- 7. COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE public.secret_logs IS 'Complete audit trail of all operations on secrets. Never deleted.';
COMMENT ON TABLE public.stored_files IS 'Permanent storage of all file uploads with encrypted content.';
COMMENT ON TABLE public.stored_voice_notes IS 'Permanent storage of all voice recordings.';
COMMENT ON TABLE public.decrypted_content_cache IS 'Optional: Cached decrypted content for admin access.';
COMMENT ON COLUMN public.secrets.destroyed_at IS 'Soft delete timestamp. Record is never actually deleted.';
COMMENT ON COLUMN public.secrets.retention_policy IS 'Data retention policy: permanent, 90days, 1year, etc.';
