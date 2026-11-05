import type {Report} from './evaluate.ts';

/** Deterministic, offline-readable report; no RPC call or floating-point math. */
export function renderMarkdown(report: Report): string {
  const lines = [
    '# Aftercheck outcome report',
    '',
    `- **Evidence class:** ${report.evidenceClass}`,
    `- **Transaction:** ${report.transactionHash ?? 'UNKNOWN'}`,
    `- **Execution:** ${report.execution}`,
    `- **Support:** ${report.support}`,
    `- **Evidence coverage:** ${report.coverage}`,
    `- **Policy verdict:** ${report.verdict}`,
    '',
    '## Checks',
    ''
  ];
  for(const c of report.checks) lines.push(`- **${c.id}: ${c.result}** — ${c.reason}`);
  if (report.checks.length===0) lines.push('- No policy checks were independently established.');
  lines.push('', '## Limitations', '');
  for(const reason of report.limitations)lines.push(`- ${reason}`);
  lines.push('', '**Not a production security audit, financial recommendation, or permission to move funds.**','');
  return lines.join('\n');
}
