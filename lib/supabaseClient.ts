"use client";

import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

// Browser Supabase client that reads/writes auth cookies so session is
// available immediately after server-side sign-in/email confirmation.
export const supabase = createClientComponentClient();
