import { useUserStore } from "@/shared/store/useUserStore";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { updateNickname } from "../api/updateNickname";

export function useChangeNickname() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateNickname,
    onMutate: () => queryClient.cancelQueries({ queryKey: ["userInfo"] }),
    onSuccess: (user) => {
      queryClient.setQueryData(["userInfo"], user);
      useUserStore.getState().setUserNickname(user.user_metadata.nickname);
    },
  });
}
