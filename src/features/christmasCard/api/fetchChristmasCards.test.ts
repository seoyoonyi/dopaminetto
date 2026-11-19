import { createClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import { fetchChristmasCards } from "./fetchChristmasCards";

describe("fetchChristmasCards", () => {
  it("최신 크리스마스 카드 6장을 페이지 단위로 조회한다", async () => {
    const rows = Array.from({ length: 2 }, (_, index) => ({
      id: index + 7,
      created_at: "2026-11-04T00:00:00Z",
      nickname: `QA_${index}`,
      content: "따뜻한 하루 되세요",
      event_type: "christmas",
      user_id: "user-id",
    }));
    const fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(rows), {
        status: 200,
        headers: { "Content-Range": "6-7/8", "Content-Type": "application/json" },
      }),
    );
    const client = createClient("https://example.test", "test-key", {
      global: { fetch },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    await expect(fetchChristmasCards(client, 2)).resolves.toEqual({ cards: rows, totalCount: 8 });
    const [url] = fetch.mock.calls[0];
    expect(String(url)).toContain("event_type=eq.christmas");
    expect(new URL(String(url)).searchParams.get("order")).toBe("created_at.desc,id.desc");
    expect(new URL(String(url)).searchParams.get("offset")).toBe("6");
    expect(new URL(String(url)).searchParams.get("limit")).toBe("6");
  });

  it("조회 오류를 호출자에게 전달한다", async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ code: "42501", message: "denied" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const client = createClient("https://example.test", "test-key", {
      global: { fetch },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    await expect(fetchChristmasCards(client, 1)).rejects.toMatchObject({ code: "42501" });
  });
});
