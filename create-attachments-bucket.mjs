#!/usr/bin/env node
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

async function main() {
  try {
    const { data, error } = await supabase.storage.createBucket('attachments', { public: true })
    if (error) {
      console.error('Failed to create bucket:', error)
      process.exit(1)
    }
    console.log('Bucket created:', data)
  } catch (err) {
    console.error('Unexpected error:', err)
    process.exit(1)
  }
}

main()
