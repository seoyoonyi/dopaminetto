// @vitest-environment jsdom
import { useMessagesQuery } from "@/features/chat/hooks/useMessagesQuery";
import { useUserStore } from "@/shared/store/useUserStore";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { act, useEffect } from "react";
import { Root, createRoot } from "react-dom/client";

import { useChatPanel } from "./useChatPanel";

// react-dom/client의 act()가 지원되는 환경임을 React에 알린다(testing-library 없이 직접
// createRoot/act를 쓰기 때문에 필요하다) — TownVoiceClient.test.tsx와 동일한 패턴.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * 수동 QA에서 재현된 문제를 다룬다: 채팅 메시지 insert가 서버에는 성공했는데도, 이전 코드는
 * Realtime postgres_changes INSERT echo가 와야만 optimistic(회색) 메시지를 확정 처리했다.
 * 잠깐 자리를 비웠다 돌아와 chat 채널이 아직 SUBSCRIBED로 재구독되기 전에 메시지를 보내면
 * echo를 영영 못 받아, 메시지가 새로고침 전까지 영구히 회색으로 남을 수 있었다.
 *
 * 수정: insert 응답(`.select().single()`)에서 받은 실제 row로, echo를 기다리지 않고
 * 그 자리에서 바로 temp -> confirmed 전환한다(useChatPanel.ts의 handleMessageSend).
 */

const { useSupabaseMock, onInsertRef, onResubscribeRef, initialStatusRef } = vi.hoisted(() => ({
  useSupabaseMock: vi.fn(),
  onInsertRef: { current: null as ((payload: { new: unknown }) => void) | null },
  onResubscribeRef: { current: null as (() => void) | null },
  initialStatusRef: { current: "SUBSCRIBED" as string },
}));

vi.mock("@/app/providers/SupabaseProvider", () => ({
  useSupabase: useSupabaseMock,
}));

// useMessagesQuery는 실제 구현을 그대로 쓰되(아래 insert 플로우 테스트가 의존), 호출 인자를
// 검증할 수 있도록 spy로 감싼다.
vi.mock("@/features/chat/hooks/useMessagesQuery", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/chat/hooks/useMessagesQuery")>();
  return { useMessagesQuery: vi.fn(actual.useMessagesQuery) };
});

// 실제 supabase.client.ts는 모듈 로드 시점에 createBrowserClient()를 호출해 env var가
// 필요하다(messageUtils.test.ts와 동일한 이유). `@/features/chat` barrel이 재export하는
// ChatHistory/MessageField가 `@/shared/hooks` barrel(→ useUserInfo → supabase.client)까지
// 끌고 오므로, leaf 모듈 자체를 mock해 근본적으로 막는다.
vi.mock("@/shared/config/supabase.client", () => ({
  supabase: {},
  CHAT_TABLE_NAME: "chat",
  CHAT_GC_CONFIG: {
    ENABLED: false,
    MAX_PAGES: 50,
    MIN_VISIBLE_PAGES: 20,
    PROTECTED_TIME_MS: 60 * 1000,
  },
}));

vi.mock("./chatChannelReconnect", () => ({
  subscribeChatChannelWithReconnect: (opts: {
    onInsert: (payload: { new: unknown }) => void;
    onStatusChange: (status: string) => void;
    onResubscribe?: () => void;
  }) => {
    onInsertRef.current = opts.onInsert;
    onResubscribeRef.current = opts.onResubscribe ?? null;
    opts.onStatusChange(initialStatusRef.current);
    return () => {
      onInsertRef.current = null;
      onResubscribeRef.current = null;
    };
  },
}));

type InsertResult = { data: unknown; error: unknown };

/** fetchMessages(읽기)와 handleMessageSend(쓰기)를 모두 지원하는 최소 fake supabase client다. */
function createFakeSupabase(
  insertImpl: () => Promise<InsertResult>,
  readImpl: () => unknown[] = () => [],
) {
  const from = vi.fn(() => ({
    select: vi.fn(() => {
      const readBuilder = {
        eq: vi.fn(() => readBuilder),
        order: vi.fn(() => readBuilder),
        limit: vi.fn(() => readBuilder),
        lt: vi.fn(() => readBuilder),
        then: (resolve: (value: { data: unknown[]; error: null }) => void) =>
          resolve({ data: readImpl(), error: null }),
      };
      return readBuilder;
    }),
    insert: vi.fn(() => {
      const insertBuilder = {
        select: vi.fn(() => insertBuilder),
        single: vi.fn(() => insertImpl()),
      };
      return insertBuilder;
    }),
  }));

  return { from } as unknown as Parameters<typeof useSupabaseMock.mockReturnValue>[0];
}

let root: Root | null = null;
let container: HTMLDivElement | null = null;

const flush = () => act(async () => new Promise((resolve) => setTimeout(resolve, 0)));

async function mount(supabase: unknown) {
  useSupabaseMock.mockReturnValue(supabase);

  const queryClient = new QueryClient();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);

  const resultRef: { current: ReturnType<typeof useChatPanel> | null } = {
    current: null,
  };

  function Harness() {
    const result = useChatPanel();
    // 렌더 중 외부 변수를 직접 수정하지 않고, effect 안에서 최신 결과를 반영한다.
    useEffect(() => {
      resultRef.current = result;
    });
    return null;
  }

  await act(async () => {
    root!.render(
      <QueryClientProvider client={queryClient}>
        <Harness />
      </QueryClientProvider>,
    );
  });
  await flush();

  return { resultRef };
}

describe("useChatPanel: insert 성공 응답으로 즉시 temp -> confirmed 전환", () => {
  beforeEach(() => {
    useUserStore.setState({ userId: "user-1", userNickname: "tester" });
    initialStatusRef.current = "SUBSCRIBED";
  });

  afterEach(() => {
    useUserStore.getState().reset();
    if (root) {
      act(() => root!.unmount());
    }
    container?.remove();
    root = null;
    container = null;
    onInsertRef.current = null;
    vi.clearAllMocks();
  });

  it("insert 성공 + Realtime echo 없음 → temp가 즉시 confirmed로 전환된다", async () => {
    const confirmedRow = {
      id: 101,
      user_id: "user-1",
      room_id: "village:lobby",
      nickname: "tester",
      message: "hello",
      created_at: "2026-08-23T00:00:00.000Z",
    };
    const supabase = createFakeSupabase(async () => ({ data: confirmedRow, error: null }));
    const { resultRef } = await mount(supabase);

    await act(async () => {
      await resultRef.current!.handleMessageSend("hello");
    });

    const messages = resultRef.current!.messages;
    expect(messages).toHaveLength(1);
    expect(messages[0].id).toBe(101);
    expect(messages.some((m) => m.id < 0)).toBe(false);
  });

  it("insert 성공 후 Realtime echo가 나중에 도착해도 중복되지 않는다", async () => {
    const confirmedRow = {
      id: 102,
      user_id: "user-1",
      room_id: "village:lobby",
      nickname: "tester",
      message: "hello",
      created_at: "2026-08-23T00:00:00.000Z",
    };
    const supabase = createFakeSupabase(async () => ({ data: confirmedRow, error: null }));
    const { resultRef } = await mount(supabase);

    await act(async () => {
      await resultRef.current!.handleMessageSend("hello");
    });

    expect(resultRef.current!.messages).toHaveLength(1);

    // 같은 row가 나중에 Realtime postgres_changes INSERT echo로 도착하는 상황을 재현한다.
    await act(async () => {
      onInsertRef.current?.({ new: confirmedRow });
    });

    const messages = resultRef.current!.messages;
    expect(messages).toHaveLength(1);
    expect(messages.filter((m) => m.id === 102)).toHaveLength(1);
  });

  it("재구독(onResubscribe) 시 messages 쿼리를 다시 fetch해 유실 메시지를 채운다", async () => {
    const missed = {
      id: 303,
      user_id: "user-2",
      room_id: "village:lobby",
      nickname: "other",
      message: "manual-long-recovery-3",
      created_at: "2026-08-23T23:10:00.000Z",
    };
    let readCount = 0;
    const supabase = createFakeSupabase(
      async () => ({ data: null, error: null }),
      () => {
        readCount += 1;
        // 최초 로드에는 없던 메시지가, 재구독 후 refetch에서 나타나는 상황을 재현한다.
        return readCount >= 2 ? [missed] : [];
      },
    );
    const { resultRef } = await mount(supabase);

    expect(resultRef.current!.messages).toHaveLength(0);

    await act(async () => {
      onResubscribeRef.current?.();
    });
    await flush();

    expect(resultRef.current!.messages.some((m) => m.id === 303)).toBe(true);
  });

  it("채널이 SUBSCRIBED면 재동기화 폴링 간격을 60초로 useMessagesQuery에 전달한다", async () => {
    initialStatusRef.current = "SUBSCRIBED";
    const supabase = createFakeSupabase(async () => ({ data: null, error: null }));
    await mount(supabase);

    expect(vi.mocked(useMessagesQuery)).toHaveBeenLastCalledWith("village:lobby", {
      reconcileIntervalMs: 60_000,
    });
  });

  it("채널이 SUBSCRIBED가 아니면 재동기화 폴링 간격을 15초로 좁힌다", async () => {
    initialStatusRef.current = "CLOSED";
    const supabase = createFakeSupabase(async () => ({ data: null, error: null }));
    await mount(supabase);

    expect(vi.mocked(useMessagesQuery)).toHaveBeenLastCalledWith("village:lobby", {
      reconcileIntervalMs: 15_000,
    });
  });

  it("realtime 채널이 SUBSCRIBED가 아니어도 신원만 있으면 canSendMessage는 true다", async () => {
    initialStatusRef.current = "CLOSED";
    const supabase = createFakeSupabase(async () => ({ data: null, error: null }));
    const { resultRef } = await mount(supabase);

    expect(resultRef.current!.isConnected).toBe(false);
    expect(resultRef.current!.canSendMessage).toBe(true);
  });

  it("insert 실패 → optimistic 메시지가 제거된다", async () => {
    const supabase = createFakeSupabase(async () => ({
      data: null,
      error: { message: "insert failed" },
    }));
    const { resultRef } = await mount(supabase);

    let sendResult: { error?: string } = {};
    await act(async () => {
      sendResult = await resultRef.current!.handleMessageSend("hello");
    });

    expect(sendResult.error).toBe("insert failed");
    expect(resultRef.current!.messages).toHaveLength(0);
  });

  it("동일 문구를 연속 전송하면, 응답 순서가 뒤바뀌어도 각 temp가 자신의 확정 메시지로만 정확히 교체된다", async () => {
    const deferred: Array<(result: InsertResult) => void> = [];
    const insertImpl = vi.fn(
      () =>
        new Promise<InsertResult>((resolve) => {
          deferred.push(resolve);
        }),
    );
    const supabase = createFakeSupabase(insertImpl);
    const { resultRef } = await mount(supabase);

    let send1: Promise<unknown> = Promise.resolve();
    let send2: Promise<unknown> = Promise.resolve();
    await act(async () => {
      send1 = resultRef.current!.handleMessageSend("hello");
      send2 = resultRef.current!.handleMessageSend("hello");
      await Promise.resolve();
    });

    const pendingAfterSend = resultRef.current!.messages.filter((m) => m.id < 0);
    expect(pendingAfterSend).toHaveLength(2);

    // 일부러 두 번째로 보낸 요청의 서버 응답을 먼저 도착시킨다(순서 뒤바뀜).
    await act(async () => {
      deferred[1]({
        data: {
          id: 202,
          user_id: "user-1",
          room_id: "village:lobby",
          nickname: "tester",
          message: "hello",
          created_at: "t2",
        },
        error: null,
      });
      await send2;
    });

    let messages = resultRef.current!.messages;
    expect(messages.some((m) => m.id === 202)).toBe(true);
    expect(messages.filter((m) => m.id < 0)).toHaveLength(1); // 첫 번째 temp는 아직 남아있어야 함

    await act(async () => {
      deferred[0]({
        data: {
          id: 201,
          user_id: "user-1",
          room_id: "village:lobby",
          nickname: "tester",
          message: "hello",
          created_at: "t1",
        },
        error: null,
      });
      await send1;
    });

    messages = resultRef.current!.messages;
    expect(messages.filter((m) => m.id < 0)).toHaveLength(0);
    expect(messages.some((m) => m.id === 201)).toBe(true);
    expect(messages.some((m) => m.id === 202)).toBe(true);
    expect(messages).toHaveLength(2);
  });
});
