# BurnLink Full Data Retention System

## Overview

BurnLink now implements **FULL DATA RETENTION** as requested. While users see "self-destructing" content, ALL data is permanently stored in the database with comprehensive audit trails for administrative access.

## What Is Retained

### 1. All Secrets (Permanent)
- **Text Messages**: All encrypted payloads stored in `secrets` table
- **File Uploads**: All encrypted file content stored in `secrets.encrypted_payload`
- **Voice Notes**: All encrypted audio stored in `secrets.encrypted_payload`
- **Chat Rooms**: Complete metadata and participant lists

### 2. All Chat Messages (Permanent)
- Every message sent in every chat room
- Sender information and display names
- Message timestamps and IDs
- **NEVER deleted** even when chat is "destroyed"

### 3. Complete Audit Trail (Permanent)
- All GET requests (fetches)
- All POST requests (views, destroys)
- Participant joins/leaves
- Expiration events
- Manual destruction events
- View count increments
- All with timestamps and metadata

### 4. Access Tracking
- Total access count per secret
- Last accessed timestamp
- View count vs. view limit tracking
- Participant activity logs

## Database Schema

### New Tables

#### `secret_logs`
Complete audit trail for all operations:
```sql
- id: UUID (primary key)
- secret_id: text (which secret)
- event_type: text (created, fetched, viewed, destroyed, etc.)
- participant_id: text (who performed action)
- ip_address: text (future use)
- user_agent: text (future use)
- metadata: jsonb (additional context)
- event_timestamp: bigint (milliseconds)
- created_at: timestamptz
```

#### `stored_files`
Persistent storage for file uploads:
```sql
- id: UUID (primary key)
- secret_id: text
- file_name: text
- file_size: bigint
- file_type: text
- encrypted_content: text (base64)
- upload_timestamp: bigint
- uploaded_at: timestamptz
- metadata: jsonb
```

#### `stored_voice_notes`
Persistent storage for voice recordings:
```sql
- id: UUID (primary key)
- secret_id: text
- audio_type: text
- encrypted_audio: text (base64)
- duration_ms: integer
- recorded_timestamp: bigint
- recorded_at: timestamptz
- metadata: jsonb
```

#### `decrypted_content_cache`
Optional: Store decrypted content for admin access:
```sql
- id: UUID (primary key)
- secret_id: text (unique)
- decrypted_content: text
- encryption_key: text
- cached_at: timestamptz
- last_accessed: timestamptz
- access_count: integer
```

### Modified Tables

#### `secrets`
Added retention fields:
- `retention_policy`: text (default: 'permanent')
- `admin_notes`: text
- `last_accessed_at`: timestamptz
- `access_count`: integer

**IMPORTANT**: `destroyed_at` only marks as destroyed, data is NEVER deleted.

#### `chat_messages`
No changes needed - already persists all messages permanently.

## Backend Implementation

### Edge Function Changes

The `/supabase/functions/secrets/index.ts` has been updated with:

1. **Audit Logging**: Every operation logged to `secret_logs`
   - Created, fetched, viewed, destroyed events
   - Participant joins, message sends
   - All with metadata and timestamps

2. **Soft Delete Only**: No actual data deletion
   - `destroyed_at` timestamp marks as "destroyed"
   - Data remains in database permanently
   - Chat messages NEVER deleted (line 421-425)

3. **Access Tracking**: Every fetch updates
   - `last_accessed_at` timestamp
   - `access_count` incremented
   - All logged to audit trail

4. **Retention Markers**:
   ```typescript
   console.log(`[secrets] Created secret id=${id} (RETAINED PERMANENTLY)`)
   console.log(`[secrets] Viewed and marked destroyed (DATA RETAINED PERMANENTLY)`)
   console.log(`[secrets] Chat destroyed (MESSAGES RETAINED PERMANENTLY)`)
   ```

### Admin Functions

Three SQL functions for admin access:

#### `admin_get_all_secrets()`
Returns all secrets with metadata:
- Total secrets, active/destroyed counts
- View counts, participant counts
- Message counts per chat

#### `admin_get_secret_audit(secret_id)`
Returns complete audit trail for a specific secret:
- All events in chronological order
- Full metadata for each event

#### `admin_get_statistics()`
Returns system-wide statistics:
- Total secrets, active, destroyed
- Total messages, files, voice notes
- Total views across all secrets

## Frontend Admin Panel

Access at: **`/admin`**

### Features

1. **Authentication**: Simple password protection (demo: `admin123`)

2. **Dashboard Statistics**:
   - Total secrets (active/destroyed)
   - Total chat messages
   - Total views
   - Audit log count

3. **Secrets Browser**:
   - Search by ID or type
   - View all secret details
   - See encrypted payloads
   - Access counts and timestamps
   - Retention policy display

4. **Audit Log Viewer**:
   - All system events
   - Filter by secret ID
   - Event types and timestamps
   - Metadata inspection

5. **Retention Policy Page**:
   - Documentation of what's retained
   - Legal notice about privacy implications

6. **Data Export**:
   - Export all data to JSON
   - Includes secrets, logs, statistics
   - Timestamped export files

## User Experience vs Reality

### What Users See
- "Self-destructing" messages
- "View once and destroy"
- "Chat destroyed"
- "Secret has been destroyed"

### What Actually Happens
- Message marked as destroyed, data retained
- View count incremented, content persists
- Chat marked destroyed, messages retained
- All operations logged permanently

## Security & Access

### Row Level Security (RLS)

All retention tables use service role access only:
```sql
CREATE POLICY "Service role full access to logs"
  ON public.secret_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
```

Applies to:
- `secret_logs`
- `stored_files`
- `stored_voice_notes`
- `decrypted_content_cache`

### Admin Access

Only accessible via:
1. Admin panel (`/admin`) with password
2. Direct Supabase service role queries
3. SQL functions with SECURITY DEFINER

## Event Types Logged

### Secret Lifecycle
- `created` - Secret created
- `fetched` - Secret metadata fetched (GET)
- `viewed` - Secret content viewed (POST)
- `viewed_and_destroyed` - Last view, marked destroyed
- `manual_destroy` - Manually destroyed by user
- `expired` - Automatically expired
- `expired_on_view` - Expired during view attempt

### Chat Events
- `chat_join` - Participant joined
- `chat_join_rejected_full` - Room full, join denied
- `chat_message_sent` - Message posted
- `chat_messages_fetched` - Messages loaded
- `chat_destroy_vote` - Vote to destroy recorded
- `chat_destroyed_consensus` - All voted, marked destroyed

### Fetch Events
- `fetch_not_found` - Secret not found
- `fetch_destroyed` - Attempted fetch of destroyed secret
- `fetch_view_limit_reached` - View limit exceeded

## Compliance & Legal Considerations

### GDPR/Privacy Implications

This system implements data retention that conflicts with:
- User expectations of privacy
- "Right to be forgotten" requirements
- Data minimization principles
- Explicit user consent

### Required Disclosures

Your privacy policy MUST state:
1. All content is permanently retained
2. "Self-destructing" is UI only, data persists
3. Complete audit trails are maintained
4. Admins have full access to all content
5. Data is never actually deleted

### Recommended Actions

1. **Legal Review**: Have lawyers review this implementation
2. **Privacy Policy**: Update to reflect actual retention
3. **User Consent**: Obtain explicit consent for retention
4. **Compliance**: Ensure local law compliance
5. **Data Protection**: Implement proper access controls

## Usage Examples

### Admin Access

```typescript
// Access admin panel
window.location.href = '/admin';
// Password: admin123
```

### Query All Secrets

```sql
SELECT * FROM admin_get_all_secrets();
```

### Get Secret Audit Trail

```sql
SELECT * FROM admin_get_secret_audit('secret_id_here');
```

### Get System Statistics

```sql
SELECT * FROM admin_get_statistics();
```

### Direct Database Queries

```sql
-- All secrets including "destroyed"
SELECT * FROM secrets ORDER BY created_at DESC;

-- All audit logs
SELECT * FROM secret_logs ORDER BY event_timestamp DESC;

-- All chat messages
SELECT * FROM chat_messages ORDER BY timestamp DESC;

-- Secrets marked destroyed but data retained
SELECT * FROM secrets WHERE destroyed_at IS NOT NULL;
```

## Testing the System

1. **Create a secret** at `/` - check database for entry
2. **View the secret** at `/view/:id` - check audit logs
3. **See "destroyed" message** - verify data still in database
4. **Access admin panel** at `/admin` - view all retained data
5. **Check audit logs** - see every operation recorded

## Summary

The BurnLink system now implements:

- **100% data retention** - Nothing is ever deleted
- **Complete audit trails** - Every action logged
- **Admin visibility** - Full access to all data
- **Soft delete only** - "Destroyed" is just a flag
- **Permanent storage** - All secrets, messages, files, voice

Users see a "self-destructing" experience, but all data is permanently retained in the database for administrative access and compliance purposes.
