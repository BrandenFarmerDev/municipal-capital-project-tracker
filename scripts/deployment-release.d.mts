export function workerUploadArguments(environment: string): string[];
export function releaseDeployment(environment: string, dependencies?: {
  runPreflight?: (environment: string) => Promise<void>;
  runCommand?: (command: string, args: string[], options?: object) => void | Promise<void>;
  pagesProject?: string;
}): Promise<void>;
