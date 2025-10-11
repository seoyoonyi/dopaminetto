"use client";

import QueryProvider from "./QueryProvider";
import SupabaseProvider from "./SupabaseProvider";

interface AppProvidersProps {
  children: React.ReactNode;
}

const AppProviders = ({ children }: AppProvidersProps) => {
  return (
    <QueryProvider>
      <SupabaseProvider>{children}</SupabaseProvider>
    </QueryProvider>
  );
};

export default AppProviders;
