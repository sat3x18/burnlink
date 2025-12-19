-- Create secrets table for encrypted payloads
CREATE TABLE public.secrets (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('message', 'files', 'voice', 'chat')),
  encrypted_payload TEXT NOT NULL,
  expiration TEXT NOT NULL,
  view_limit INTEGER NOT NULL DEFAULT 1,
  view_count INTEGER NOT NULL DEFAULT 0,
  participants TEXT[] DEFAULT '{}',
  has_password BOOLEAN NOT NULL DEFAULT FALSE,
  require_click BOOLEAN NOT NULL DEFAULT TRUE,
  destroy_after_seconds INTEGER,
  created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  destroy_votes TEXT[] DEFAULT '{}',
  destroyed_at BIGINT
);

-- Enable RLS
ALTER TABLE public.secrets ENABLE ROW LEVEL SECURITY;

-- Allow anyone to create secrets (anonymous users)
CREATE POLICY "Anyone can create secrets"
ON public.secrets FOR INSERT
WITH CHECK (true);

-- Allow anyone to read secrets (they need the key to decrypt)
CREATE POLICY "Anyone can read secrets"
ON public.secrets FOR SELECT
USING (true);

-- Allow anyone to update secrets (for view count, participants)
CREATE POLICY "Anyone can update secrets"
ON public.secrets FOR UPDATE
USING (true);

-- Allow anyone to delete secrets (for destruction)
CREATE POLICY "Anyone can delete secrets"
ON public.secrets FOR DELETE
USING (true);

-- Create chat messages table
CREATE TABLE public.chat_messages (
  id TEXT PRIMARY KEY,
  secret_id TEXT NOT NULL REFERENCES public.secrets(id) ON DELETE CASCADE,
  visible_id TEXT NOT NULL,
  text TEXT NOT NULL,
  sender TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  timestamp BIGINT NOT NULL
);

-- Enable RLS
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Allow anyone to create messages
CREATE POLICY "Anyone can create chat messages"
ON public.chat_messages FOR INSERT
WITH CHECK (true);

-- Allow anyone to read messages
CREATE POLICY "Anyone can read chat messages"
ON public.chat_messages FOR SELECT
USING (true);

-- Enable realtime for chat messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.secrets;