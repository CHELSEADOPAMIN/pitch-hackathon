import { config as loadDotenv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

let loaded = false;

export const loadEnvironment = () => {
  if (loaded) return;
  loaded = true;

  const here = dirname(fileURLToPath(import.meta.url));
  loadDotenv({ path: resolve(here, "../../../../.env"), override: false });
  loadDotenv({ path: resolve(process.cwd(), ".env"), override: false });
};
