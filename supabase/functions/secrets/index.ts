import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.89.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Parse expiration string to milliseconds
function parseExpiration(exp: string): number {
  const match = exp.match(/(\d+)([mhd])/)
  if (!match) return 3600000 // Default 1 hour
  const [, num, unit] = match
  const multipliers: Record<string, number> = {
    m: 60000,
    h: 3600000,
    d: 86400000,
  }
  return parseInt(num) * (multipliers[unit] || 3600000)
}

// Generate a secure random ID
function generateSecureId(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  let result = ''
  for (let i = 0; i < bytes.length; i++) {
    result += String.fromCharCode(bytes[i])
  }
  return btoa(result)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  const url = new URL(req.url)
  const pathParts = url.pathname.split('/').filter(Boolean)
  
  // Path: /secrets or /secrets/[id] or /secrets/[id]/view
  const secretId = pathParts[1] || null
  const action = pathParts[2] || null

  console.log(`[secrets] ${req.method} path=${url.pathname} secretId=${secretId} action=${action}`)

  try {
    // POST /secrets - Create a new secret
    if (req.method === 'POST' && !secretId) {
      const body = await req.json()
      const {
        type,
        encrypted_payload,
        expiration,
        view_limit = 1,
        has_password = false,
        require_click = true,
        destroy_after_seconds = null,
      } = body

      if (!type || !encrypted_payload || !expiration) {
        return new Response(
          JSON.stringify({ error: 'Missing required fields: type, encrypted_payload, expiration' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const id = generateSecureId()
      const now = Date.now()

      const { error } = await supabase.from('secrets').insert({
        id,
        type,
        encrypted_payload,
        expiration,
        view_limit: type === 'chat' ? Math.max(2, view_limit) : view_limit,
        view_count: 0,
        participants: [],
        has_password,
        require_click,
        destroy_after_seconds,
        created_at: now,
        destroy_votes: [],
        destroyed_at: null,
      })

      if (error) {
        console.error('[secrets] Create error:', error)
        return new Response(
          JSON.stringify({ error: 'Failed to create secret' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      console.log(`[secrets] Created secret id=${id} type=${type}`)
      return new Response(
        JSON.stringify({ id, created_at: now }),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // GET /secrets/[id] - Fetch secret without destroying
    if (req.method === 'GET' && secretId && !action) {
      const { data, error } = await supabase
        .from('secrets')
        .select('*')
        .eq('id', secretId)
        .maybeSingle()

      if (error || !data) {
        console.log(`[secrets] Not found id=${secretId}`)
        return new Response(
          JSON.stringify({ error: 'not-found', message: 'Secret not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Check if already destroyed
      if (data.destroyed_at) {
        console.log(`[secrets] Already destroyed id=${secretId}`)
        return new Response(
          JSON.stringify({ error: 'destroyed', message: 'Secret has been destroyed' }),
          { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Check expiration
      const expirationMs = parseExpiration(data.expiration)
      if (Date.now() > data.created_at + expirationMs) {
        console.log(`[secrets] Expired id=${secretId}`)
        // Mark as destroyed
        await supabase.from('secrets').update({ destroyed_at: Date.now() }).eq('id', secretId)
        return new Response(
          JSON.stringify({ error: 'expired', message: 'Secret has expired' }),
          { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // For non-chat secrets, check view limit (but don't destroy on GET)
      if (data.type !== 'chat' && data.view_count >= data.view_limit) {
        console.log(`[secrets] View limit reached id=${secretId}`)
        return new Response(
          JSON.stringify({ error: 'destroyed', message: 'Secret has been destroyed (view limit reached)' }),
          { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Return secret data (without marking as viewed - that happens on POST /view)
      console.log(`[secrets] Fetched id=${secretId} type=${data.type} views=${data.view_count}/${data.view_limit}`)
      return new Response(
        JSON.stringify({
          id: data.id,
          type: data.type,
          encrypted_payload: data.encrypted_payload,
          expiration: data.expiration,
          view_limit: data.view_limit,
          view_count: data.view_count,
          participants: data.participants || [],
          has_password: data.has_password,
          require_click: data.require_click,
          destroy_after_seconds: data.destroy_after_seconds,
          created_at: data.created_at,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // POST /secrets/[id]/view - Confirm view, increment count, potentially destroy
    if (req.method === 'POST' && secretId && action === 'view') {
      const body = await req.json().catch(() => ({}))
      const { participant_id } = body

      // Re-fetch to get current state atomically
      const { data, error } = await supabase
        .from('secrets')
        .select('*')
        .eq('id', secretId)
        .maybeSingle()

      if (error || !data) {
        return new Response(
          JSON.stringify({ error: 'not-found', message: 'Secret not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (data.destroyed_at) {
        return new Response(
          JSON.stringify({ error: 'destroyed', message: 'Secret has been destroyed' }),
          { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Check expiration
      const expirationMs = parseExpiration(data.expiration)
      if (Date.now() > data.created_at + expirationMs) {
        await supabase.from('secrets').update({ destroyed_at: Date.now() }).eq('id', secretId)
        return new Response(
          JSON.stringify({ error: 'expired', message: 'Secret has expired' }),
          { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (data.type === 'chat') {
        // Chat: Add participant if not already in list
        const participants = data.participants || []
        
        if (participant_id && !participants.includes(participant_id)) {
          if (participants.length >= data.view_limit) {
            return new Response(
              JSON.stringify({ error: 'chat-full', message: 'Chat room is full' }),
              { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }
          
          const updatedParticipants = [...participants, participant_id]
          await supabase
            .from('secrets')
            .update({ 
              participants: updatedParticipants,
              view_count: updatedParticipants.length 
            })
            .eq('id', secretId)
          
          console.log(`[secrets] Participant joined chat id=${secretId} count=${updatedParticipants.length}`)
          return new Response(
            JSON.stringify({ 
              success: true, 
              view_count: updatedParticipants.length,
              participants: updatedParticipants 
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            view_count: data.view_count,
            participants: participants 
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      } else {
        // Non-chat: Increment view count and potentially destroy
        const newViewCount = data.view_count + 1
        const shouldDestroy = newViewCount >= data.view_limit

        if (shouldDestroy) {
          // Mark as destroyed immediately
          await supabase
            .from('secrets')
            .update({ 
              view_count: newViewCount,
              destroyed_at: Date.now() 
            })
            .eq('id', secretId)
          
          console.log(`[secrets] Viewed and destroyed id=${secretId}`)
        } else {
          await supabase
            .from('secrets')
            .update({ view_count: newViewCount })
            .eq('id', secretId)
          
          console.log(`[secrets] Viewed id=${secretId} count=${newViewCount}/${data.view_limit}`)
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            view_count: newViewCount,
            destroyed: shouldDestroy,
            views_remaining: data.view_limit - newViewCount
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // POST /secrets/[id]/destroy - Manually destroy a secret
    if (req.method === 'POST' && secretId && action === 'destroy') {
      const body = await req.json().catch(() => ({}))
      const { participant_id } = body

      const { data, error } = await supabase
        .from('secrets')
        .select('*')
        .eq('id', secretId)
        .maybeSingle()

      if (error || !data) {
        return new Response(
          JSON.stringify({ error: 'not-found', message: 'Secret not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (data.destroyed_at) {
        return new Response(
          JSON.stringify({ error: 'destroyed', message: 'Secret already destroyed' }),
          { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (data.type === 'chat') {
        // Chat requires consensus - add vote
        const destroyVotes = data.destroy_votes || []
        const participants = data.participants || []

        if (participant_id && !destroyVotes.includes(participant_id)) {
          destroyVotes.push(participant_id)
        }

        // Check if all participants voted
        if (destroyVotes.length >= participants.length && participants.length > 0) {
          // Delete chat messages and mark secret as destroyed
          await supabase.from('chat_messages').delete().eq('secret_id', secretId)
          await supabase.from('secrets').update({ destroyed_at: Date.now(), destroy_votes: destroyVotes }).eq('id', secretId)
          
          console.log(`[secrets] Chat destroyed by consensus id=${secretId}`)
          return new Response(
            JSON.stringify({ success: true, destroyed: true }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        } else {
          await supabase.from('secrets').update({ destroy_votes: destroyVotes }).eq('id', secretId)
          
          console.log(`[secrets] Destroy vote recorded id=${secretId} votes=${destroyVotes.length}/${participants.length}`)
          return new Response(
            JSON.stringify({ 
              success: true, 
              destroyed: false,
              votes: destroyVotes.length,
              required: participants.length 
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      } else {
        // Non-chat: destroy immediately
        await supabase.from('secrets').update({ destroyed_at: Date.now() }).eq('id', secretId)
        
        console.log(`[secrets] Secret destroyed id=${secretId}`)
        return new Response(
          JSON.stringify({ success: true, destroyed: true }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // POST /secrets/[id]/chat - Send a chat message
    if (req.method === 'POST' && secretId && action === 'chat') {
      const body = await req.json()
      const { id, visible_id, text, sender, sender_name } = body

      if (!id || !text || !sender) {
        return new Response(
          JSON.stringify({ error: 'Missing required fields' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Verify secret exists and is a chat
      const { data: secretData, error: secretError } = await supabase
        .from('secrets')
        .select('type, destroyed_at')
        .eq('id', secretId)
        .maybeSingle()

      if (secretError || !secretData || secretData.type !== 'chat') {
        return new Response(
          JSON.stringify({ error: 'Invalid chat' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (secretData.destroyed_at) {
        return new Response(
          JSON.stringify({ error: 'destroyed', message: 'Chat has been destroyed' }),
          { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const { error } = await supabase.from('chat_messages').insert({
        id,
        secret_id: secretId,
        visible_id: visible_id || sender.slice(-4),
        text,
        sender,
        sender_name: sender_name || 'Anonymous',
        timestamp: Date.now(),
      })

      if (error) {
        console.error('[secrets] Chat message error:', error)
        return new Response(
          JSON.stringify({ error: 'Failed to send message' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      console.log(`[secrets] Chat message sent id=${secretId}`)
      return new Response(
        JSON.stringify({ success: true }),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // GET /secrets/[id]/chat - Get chat messages
    if (req.method === 'GET' && secretId && action === 'chat') {
      const { data: secretData } = await supabase
        .from('secrets')
        .select('type, destroyed_at, destroy_votes, participants')
        .eq('id', secretId)
        .maybeSingle()

      if (!secretData || secretData.type !== 'chat') {
        return new Response(
          JSON.stringify({ error: 'Invalid chat' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (secretData.destroyed_at) {
        return new Response(
          JSON.stringify({ error: 'destroyed', message: 'Chat has been destroyed' }),
          { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const { data: messages, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('secret_id', secretId)
        .order('timestamp', { ascending: true })

      if (error) {
        return new Response(
          JSON.stringify({ error: 'Failed to fetch messages' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({ 
          messages: messages || [],
          destroy_votes: secretData.destroy_votes || [],
          participants: secretData.participants || []
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[secrets] Error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
