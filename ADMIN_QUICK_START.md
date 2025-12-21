# BurnLink Admin Panel - Quick Start Guide

## Accessing the Admin Panel

1. Navigate to: **`http://your-domain.com/admin`**
2. Enter password: **`admin123`** (demo password)
3. Click "Login"

## Dashboard Overview

### Statistics Cards
- **Total Secrets**: All created secrets (active + destroyed)
- **Chat Messages**: All retained messages
- **Total Views**: Sum of all view counts
- **Audit Logs**: Number of tracked events

## Features

### 1. Secrets Browser

**Search Secrets**:
- Type in search box to filter by ID or type
- Click any secret card to view audit trail

**Secret Information**:
- Secret ID (unique identifier)
- Type: message, files, voice, or chat
- Status: Active or Destroyed (with trash icon)
- View count and limit
- Access count (total fetches)
- Creation timestamp
- Destruction timestamp (if destroyed)
- Encrypted payload preview
- Retention policy

### 2. Audit Logs Viewer

**View All Logs**:
- Shows latest 100 events
- Ordered by most recent first

**Per-Secret Logs**:
- Click a secret in Secrets tab
- Switch to Logs tab
- See only events for that secret
- Click "Show all logs" to return

**Log Information**:
- Event type (created, viewed, destroyed, etc.)
- Timestamp (exact date/time)
- Secret ID
- Participant ID (if applicable)
- Metadata (JSON details)

### 3. Retention Policy

**View Documentation**:
- What data is retained
- What's never deleted
- Legal compliance notice

## Common Operations

### View a Specific Secret's History

1. Go to "All Secrets" tab
2. Search for secret ID
3. Click the secret card
4. Switch to "Audit Logs" tab
5. See complete event history

### Export All Data

1. Click "Export Data" button (top right)
2. Downloads JSON file with:
   - All secrets
   - All logs
   - Statistics
   - Export timestamp

### Check if Data is Really Retained

1. Create a secret on main page
2. View it once (should show "destroyed")
3. Go to admin panel
4. Find secret in "All Secrets"
5. Verify `destroyed_at` is set but data exists
6. Check "Audit Logs" for all events

## Direct Database Access

If you have Supabase access:

### View All Secrets (Including Destroyed)
```sql
SELECT * FROM secrets ORDER BY created_at DESC;
```

### View All Audit Logs
```sql
SELECT * FROM secret_logs ORDER BY event_timestamp DESC;
```

### View All Chat Messages
```sql
SELECT * FROM chat_messages ORDER BY timestamp DESC;
```

### Find Destroyed Secrets with Data
```sql
SELECT id, type, destroyed_at, encrypted_payload
FROM secrets
WHERE destroyed_at IS NOT NULL
LIMIT 10;
```

### Get Statistics
```sql
SELECT * FROM admin_get_statistics();
```

### Get Audit Trail for Specific Secret
```sql
SELECT * FROM admin_get_secret_audit('your-secret-id-here');
```

## Event Types Reference

### Creation
- `created` - New secret created

### Access
- `fetched` - Secret metadata loaded
- `viewed` - Secret content viewed
- `fetch_not_found` - Secret doesn't exist
- `fetch_destroyed` - Tried to fetch destroyed secret

### Destruction
- `viewed_and_destroyed` - Last view, auto-destroyed
- `manual_destroy` - User manually destroyed
- `expired` - Auto-expired by time
- `expired_on_view` - Expired during view

### Chat
- `chat_join` - User joined chat
- `chat_message_sent` - Message posted
- `chat_messages_fetched` - Messages loaded
- `chat_destroy_vote` - Vote to destroy
- `chat_destroyed_consensus` - All voted, destroyed

## Understanding the Data

### "Destroyed" Secrets
- Have `destroyed_at` timestamp
- Still have full `encrypted_payload`
- All audit logs retained
- Appear as "destroyed" to users
- Fully accessible to admins

### Chat Messages
- Never deleted from database
- Remain even after chat "destroyed"
- Full conversation history retained
- All sender information preserved

### Audit Logs
- Immutable once created
- Permanent record of all actions
- Include full metadata
- Timestamps in milliseconds
- UTC timezone

## Security Notes

1. **Change Admin Password**: The demo password `admin123` should be changed in production
2. **RLS Protection**: All data tables use service role access only
3. **No User Access**: Regular users cannot access admin functions
4. **Audit Everything**: All admin actions should also be logged

## Troubleshooting

### Can't See Recent Secret
- Click "Refresh" button (top right)
- Check if secret ID is correct
- Verify database connection

### No Logs Showing
- Ensure edge function is deployed
- Check Supabase logs for errors
- Verify `secret_logs` table exists

### Empty Statistics
- Run `loadAdminData()` function
- Check database permissions
- Verify admin functions exist

## Production Deployment

### Before Going Live

1. **Change admin password** in `src/pages/Admin.tsx`
2. **Add authentication** (not just password)
3. **Implement role-based access** control
4. **Add IP whitelisting** for admin panel
5. **Enable audit logging** for admin actions
6. **Update privacy policy** to disclose retention
7. **Implement data export** for GDPR requests
8. **Add data anonymization** tools (if needed)

### Recommended Enhancements

- Multi-factor authentication
- Session management
- Admin action logging
- IP-based restrictions
- Rate limiting
- Database backup automation
- Compliance reporting tools
- Data retention period controls

## Support

For issues or questions:
1. Check `DATA_RETENTION_DOCUMENTATION.md`
2. Review Supabase edge function logs
3. Inspect browser console for errors
4. Verify database schema matches migration
