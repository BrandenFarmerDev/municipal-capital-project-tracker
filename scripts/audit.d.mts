export function validateAuditResult(result: { error?: Error; status?: number; stdout?: string }): { exitCode: number; vulnerabilities: Record<string, number> };
export function auditDependencies(run?: (command: string, args: string[]) => { error?: Error; status?: number; stdout?: string }): void;
