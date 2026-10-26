import { MapLoader } from "@/entities/village";
import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

import * as sourceResolvers from "./resolveChristmasTreeSources";

const loadTownMap = () => {
  const tmjPath = path.resolve(process.cwd(), "public/assets/images/town-map.tmj");
  return new MapLoader(JSON.parse(readFileSync(tmjPath, "utf8")));
};

describe("resolveChristmasTreeSources", () => {
  it("Effects 트리 기준점을 로비 환경음 소스로 사용한다", () => {
    const mapLoader = loadTownMap();
    const resolver = (sourceResolvers as Record<string, unknown>).resolveChristmasTreeSources as
      | ((loader: MapLoader) => unknown[])
      | undefined;

    expect(resolver).toBeTypeOf("function");
    expect(resolver?.(mapLoader)).toEqual([
      { id: "christmas-tree-436", villageId: "lobby", x: 734, y: 857 },
    ]);
  });
});
