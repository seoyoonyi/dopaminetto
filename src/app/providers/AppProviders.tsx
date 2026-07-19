"use client";

import AnalyticsProvider from "./AnalyticsProvider";
import QueryProvider from "./QueryProvider";
import SupabaseProvider from "./SupabaseProvider";

interface AppProvidersProps {
  children: React.ReactNode;
}

const AppProviders = ({ children }: AppProvidersProps) => {
  return (
    <QueryProvider>
      <SupabaseProvider>
        <AnalyticsProvider>{children}</AnalyticsProvider>
      </SupabaseProvider>
    </QueryProvider>
  );
};

export default AppProviders;
