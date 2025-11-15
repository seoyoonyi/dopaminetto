import { supabase } from "@/shared/config/supabase.client";
import { useQuery } from "@tanstack/react-query";

const fetchUserInfo = async () => {
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    throw error;
  }
  return data.user;
};

export const useUserInfo = () => {
  return useQuery({
    queryKey: ["userInfo"],
    queryFn: fetchUserInfo,
    staleTime: Infinity,
  });
};
