export function verifyArchiveDigest(actual: string, expected: string, name: string): void;
export function ensureCodeQLParserModuleScope(parserDirectory: string): string;
type ExtractionResult = { error?: Error; status: number | null };
type ExtractionProcess = (command: string, args: string[], options: { stdio: "inherit" }) => ExtractionResult;
export function extractArchive(archive: string, destination: string, targetPlatform?: "windows" | "linux", spawn?: ExtractionProcess): void;
