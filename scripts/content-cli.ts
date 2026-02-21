import { promises as fs } from "node:fs";
import path from "node:path";

import { cac } from "cac";
import JSON5 from "json5";

import { loadContentEntries } from "./content/nodeLoader";
import { buildContentRegistry } from "../src/content/validation";

const CONTENT_ROOT = path.resolve(process.cwd(), "content");

const toTitle = (id: string): string => {
  const trimmed = id.replace(/^L\d+_?/i, "");
  return trimmed
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
};

const readJsonFile = async (filePath: string): Promise<unknown> => {
  const raw = await fs.readFile(filePath, "utf-8");
  return JSON5.parse(raw) as unknown;
};

const writeJsonFile = async (
  filePath: string,
  data: unknown,
): Promise<void> => {
  const formatted = `${JSON.stringify(data, null, 2)}\n`;
  await fs.writeFile(filePath, formatted, "utf-8");
};

const runValidate = async (): Promise<number> => {
  const { entries, errors: parseErrors } = await loadContentEntries();
  const result = buildContentRegistry(entries);
  const errors = [...parseErrors, ...result.errors];
  if (errors.length === 0) {
    console.log("Content OK.");
    return 0;
  }
  console.error("Content validation failed:");
  for (const error of errors) {
    console.error(`- [${error.kind}] ${error.path}: ${error.message}`);
  }
  return 1;
};

const runScaffoldLevel = async (
  id: string,
  fromId?: string,
): Promise<number> => {
  const targetPath = path.join(CONTENT_ROOT, "levels", `${id}.json5`);
  try {
    await fs.access(targetPath);
    console.error(`Level file already exists: ${targetPath}`);
    return 1;
  } catch {
    // continue
  }

  let base: Record<string, unknown> = {
    id,
    pressureProfile: { primary: "enemy" },
    title: toTitle(id) || id,
    waveIds: [],
    winCondition: { kind: "clearWaves" },
  };

  if (fromId) {
    const json5Path = path.join(CONTENT_ROOT, "levels", `${fromId}.json5`);
    const jsonPath = path.join(CONTENT_ROOT, "levels", `${fromId}.json`);
    try {
      const sourcePath = await fs
        .access(json5Path)
        .then(() => json5Path)
        .catch(() => jsonPath);
      const source = (await readJsonFile(sourcePath)) as Record<
        string,
        unknown
      >;
      base = { ...source };
    } catch {
      console.error(`Unable to read source level: ${fromId}`);
      return 1;
    }
  }

  base.id = id;
  base.title = toTitle(id) || id;

  await writeJsonFile(targetPath, base);
  console.log(`Scaffolded level: ${targetPath}`);
  return 0;
};

const runPrintLevel = async (id: string): Promise<number> => {
  const { entries, errors: parseErrors } = await loadContentEntries();
  const result = buildContentRegistry(entries);
  const errors = [...parseErrors, ...result.errors];
  if (errors.length > 0) {
    console.error("Content has validation errors:");
    for (const error of errors) {
      console.error(`- [${error.kind}] ${error.path}: ${error.message}`);
    }
    return 1;
  }

  const level = result.registry.levelsById[id];
  if (!level) {
    console.error(`Level not found: ${id}`);
    return 1;
  }

  const waveIds = level.waves.map((wave) => wave.id);
  const hazardTypes = level.hazards?.map((hazard) => hazard.type) ?? [];
  const shopSummary = level.shopRules
    ? {
        ships: level.shopRules.allowedShips?.length ?? 0,
        weapons: level.shopRules.allowedWeapons?.length ?? 0,
      }
    : null;

  console.log(`Level ${level.id}: ${level.title}`);
  console.log(`Pressure: ${level.pressureProfile.primary}`);
  if (level.pressureProfile.secondary?.length) {
    console.log(`Secondary: ${level.pressureProfile.secondary.join(", ")}`);
  }
  console.log(`Win: ${level.winCondition.kind}`);
  console.log(`Waves: ${waveIds.length} (${waveIds.join(", ") || "none"})`);
  console.log(`Hazards: ${hazardTypes.join(", ") || "none"}`);
  if (shopSummary) {
    console.log(
      `Shop: ${shopSummary.weapons} weapons, ${shopSummary.ships} ships`,
    );
  } else {
    console.log("Shop: none");
  }
  return 0;
};

const runCommand = (command: () => Promise<number>): void => {
  void command()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
};

const cli = cac("content-cli");

cli
  .command("validate", "Validate all content")
  .action(() => runCommand(() => runValidate()));

cli
  .command("scaffold <kind> <id>", "Scaffold content")
  .option("-f, --from <existingId>", "Clone fields from an existing level")
  .action((kind: string, id: string, options: { from?: string }) => {
    if (kind !== "level") {
      console.error("Usage: scaffold level <ID> [--from <EXISTING_ID>]");
      process.exitCode = 1;
      return;
    }
    runCommand(() => runScaffoldLevel(id, options.from));
  });

cli
  .command("print <kind> <id>", "Print content summary")
  .action((kind: string, id: string) => {
    if (kind !== "level") {
      console.error("Usage: print level <ID>");
      process.exitCode = 1;
      return;
    }
    runCommand(() => runPrintLevel(id));
  });

cli.help();

cli.on("command:*", () => {
  console.error(`Unknown command: ${cli.args.join(" ")}`);
  cli.outputHelp();
  process.exitCode = 1;
});

if (process.argv.slice(2).length === 0) {
  cli.outputHelp();
  process.exitCode = 1;
} else {
  cli.parse();
}
