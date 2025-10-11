"use client";

import { createBrowserClient } from "@supabase/ssr";

import { createContext, useContext } from "react";

// Supabase 클라이언트 생성 (익명 접속용, SSR 지원)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

// Context 생성
const SupabaseContext = createContext(supabase);

interface SupabaseProviderProps {
  children: React.ReactNode;
}

const SupabaseProvider = ({ children }: SupabaseProviderProps) => {
  return <SupabaseContext.Provider value={supabase}>{children}</SupabaseContext.Provider>;
};

// Hook for using Supabase client
export const useSupabase = () => {
  return useContext(SupabaseContext);
};

export default SupabaseProvider;
