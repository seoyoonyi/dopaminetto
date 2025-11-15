"use client";

import { supabase } from "@/shared/config/supabase.client";

import { createContext, useContext } from "react";

const SupabaseContext = createContext(supabase);

interface SupabaseProviderProps {
  children: React.ReactNode;
}

const SupabaseProvider = ({ children }: SupabaseProviderProps) => {
  return <SupabaseContext.Provider value={supabase}>{children}</SupabaseContext.Provider>;
};

export const useSupabase = () => {
  return useContext(SupabaseContext);
};

export default SupabaseProvider;
