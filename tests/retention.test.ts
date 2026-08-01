import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { pruneDataFiles } from "@/lib/data";

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true }))); });

describe("seven-day retention", () => {
  it("keeps exactly today and the prior six days in both data folders", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "artnews-retention-")); roots.push(root);
    for (const dir of ["daily", "karina"]) {
      await fs.mkdir(path.join(root, dir), { recursive: true });
      for (let day = 23; day <= 31; day += 1) await fs.writeFile(path.join(root, dir, `2026-07-${day}.json`), "{}");
      await fs.writeFile(path.join(root, dir, "2026-08-01.json"), "{}");
    }
    const dates = await pruneDataFiles(root, "2026-08-01");
    expect(dates).toHaveLength(7);
    expect(dates[0]).toBe("2026-08-01");
    expect(dates.at(-1)).toBe("2026-07-26");
    expect((await fs.readdir(path.join(root, "karina"))).filter((file) => file.endsWith(".json"))).toHaveLength(7);
  });
});
