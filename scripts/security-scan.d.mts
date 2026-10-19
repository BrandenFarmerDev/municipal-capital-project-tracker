export interface SarifReport {
  version: string;
  runs: Array<{
    tool?: { driver?: { name?: string } };
    results?: unknown[];
    invocations?: Array<{ executionSuccessful?: boolean }>;
  }>;
}

export interface ScannerDependencies {
  runScanner?: (command: string, args: string[]) => void;
  readSarif?: (path: string) => Promise<string | unknown>;
  makeReportDirectory?: () => Promise<unknown>;
}

export function validateSarif(report: unknown, expectedTool: string, requireSuccessfulExecution?: boolean): void;
export function assertScannerSucceeded(result: { error?: Error | null; status?: number | null; stderr?: string | null }, command: string): void;
export function scanSecrets(paths: string[], dependencies?: ScannerDependencies): Promise<void>;
export function scan(paths: string[], dependencies?: ScannerDependencies): Promise<void>;
export function deploymentArtifactPaths(environment: string): string[];
export function sourceFiles(runGit?: (args: string[]) => { status?: number; stdout: string; stderr?: string; error?: Error }): Promise<string[]>;
export function withSourceSnapshot<T>(action: (root: string) => Promise<T>, dependencies?: { listFiles?: () => Promise<string[]>; copyFile?: (source: string, destination: string) => Promise<void>; makeTempDirectory?: () => Promise<string>; removeDirectory?: (path: string, options: { recursive: boolean; force: boolean }) => Promise<void> }): Promise<T>;
export function runScanCli(args: string[], environment: string | undefined, dependencies?: ScannerDependencies & { sourceRoot?: string; listFiles?: () => Promise<string[]>; copyFile?: (source: string, destination: string) => Promise<void>; makeTempDirectory?: () => Promise<string>; removeDirectory?: (path: string, options: { recursive: boolean; force: boolean }) => Promise<void> }): Promise<void>;
