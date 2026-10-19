export function run(command: string, args: string[], options?: object, spawn?: (command: string, args: string[], options?: object) => { error?: Error | null; status?: number | null }): void;
export function runDeploymentPreflight(
  environment: string,
  buildWorker: (environment: string) => void | Promise<void>,
  buildFrontend: () => void | Promise<void>,
  scanArtifacts: (environment: string) => void | Promise<void>,
): Promise<void>;
export function preflight(environment: string, dependencies?: {
  runCommand?: (command: string, args: string[]) => void | Promise<void>;
  scanArtifacts?: (environment: string) => void | Promise<void>;
  scanArtifactSecrets?: (paths: string[]) => void | Promise<void>;
}): Promise<void>;
