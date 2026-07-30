import { spawnSync } from 'node:child_process';

import { config as loadDotEnv } from 'dotenv';

import {
  finalBuildEnvironmentKeys,
  resolveFinalBuildEnvironment,
} from './final-build-env';

const envFile = process.env.PINCH_ENV_FILE ?? '.env';
loadDotEnv({ path: envFile, quiet: true });

const environment = resolveFinalBuildEnvironment(process.env);
const [command, ...args] = process.argv.slice(2);

if (!command) {
  console.info(
    `Final environment is valid: ${finalBuildEnvironmentKeys.server.length} ` +
      `server values and ${finalBuildEnvironmentKeys.client.length} ` +
      'client/build values are ready.',
  );
} else {
  const result = spawnSync(command, args, {
    env: environment,
    stdio: 'inherit',
  });
  if (result.error) {
    throw result.error;
  }
  process.exitCode = result.status ?? 1;
}
