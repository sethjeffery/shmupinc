import { promises as fs } from "node:fs";
import path from "node:path";

import { LEGACY_ENEMIES } from "../../src/game/data/enemies";
import { LEGACY_SECONDARY_WEAPONS } from "../../src/game/data/secondaryWeapons";
import { LEGACY_SHIPS } from "../../src/game/data/ships";
import { LEGACY_WEAPONS } from "../../src/game/data/weapons";

const CONTENT_ROOT = path.resolve(process.cwd(), "content");

const writeJsonFile = async (dir: string, id: string, data: unknown): Promise<void> => {
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, `${id}.json5`);
  const output = `${JSON.stringify(data, null, 2)}\n`;
  await fs.writeFile(filePath, output, "utf-8");
};

const writeRecord = async <T extends { id: string }>(
  dirName: string,
  record: Record<string, T>,
): Promise<void> => {
  const dir = path.join(CONTENT_ROOT, dirName);
  const entries = Object.values(record);
  for (const entry of entries) {
    await writeJsonFile(dir, entry.id, entry);
  }
};

const run = async (): Promise<void> => {
  await writeRecord("enemies", LEGACY_ENEMIES);
  await writeRecord("weapons", LEGACY_WEAPONS);
  await writeRecord("secondaryWeapons", LEGACY_SECONDARY_WEAPONS);
  await writeRecord("ships", LEGACY_SHIPS);
  console.log("Exported legacy content.");
};

run().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
