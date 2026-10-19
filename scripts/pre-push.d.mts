export type Publication =
  | { deletion: true; remoteRef: string }
  | { deletion: false; localRef: string; remoteRef: string };

export interface QualityGateOptions {
  initialHead: string;
  publicationHead: string;
  quality: () => void;
  currentHead: () => string;
  currentPublicationHead: () => string;
  workingTreeClean: () => boolean;
}

export function validatePublication(lines: string[], currentBranch: string, headSha: string): Publication;
export function git(args: string[], spawn?: (command: string, args: string[], options?: object) => { error?: Error | null; status?: number | null; stdout?: string | null; stderr?: string | null }): string;
export function run(command: string, args: string[], spawn?: (command: string, args: string[], options?: object) => { error?: Error | null; status?: number | null }): void;
export function runValidatedQuality(options: QualityGateOptions): void;
export function runPrePush(stdin: string, dependencies?: {
  gitCommand?: (args: string[]) => string;
  runQuality?: () => void;
  cleanWorkingTree?: () => boolean;
}): void;
