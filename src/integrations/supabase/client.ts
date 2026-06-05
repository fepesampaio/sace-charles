import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://iwgdryvqvwijdorrgknc.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3Z2RyeXZxdndpamRvcnJna25jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MTA2OTAsImV4cCI6MjA4OTE4NjY5MH0._1bCbsxYUCeT8h26vy-OpFEEBKpPt9ys4O1sFGXMF8g";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
