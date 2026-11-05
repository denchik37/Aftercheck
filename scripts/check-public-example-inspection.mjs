import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve, join} from 'node:path';
import {parseEvidence} from '../src/evidence.ts';
import {verifyEvidence} from '../src/verify.ts';
import {canonicalJson} from '../src/json.ts';
import {parsePolicy} from '../src/policy.ts';
import {renderMarkdown} from '../src/report.ts';

// Validate persisted report output from live inspect or offline replay of the
// retained public case. This is not a new RPC read or provider authentication.
try {
  if (process.argv.length !== 3) throw new Error('INVALID_CHECK_ARGUMENTS');
  const dir = resolve(process.argv[2]);
  const read = async name => readFile(join(dir,name),'utf8');
  const evidence = parseEvidence(JSON.parse(await read('evidence.json')));
  const policy = parsePolicy(JSON.parse(await read('policy.json')));
  const reportText = await read('report.json');
  const report = JSON.parse(reportText);
  const replay = verifyEvidence(evidence,policy);
  assert.equal(reportText, canonicalJson(replay) + '\n', 'persisted report must match re-evaluation');
  assert.equal(await read('report.md'),renderMarkdown(replay),'Markdown output must match re-evaluation');
  assert.equal(evidence.evidenceClass,'RPC_RECEIPT');
  assert.equal(evidence.transactionHash,
    '0x608ca58e7d01dbe0c7fe48af8c0bb9f2bddcf07ccc36f5c28d033bc8d198d5e9');
  assert.equal(replay.execution,'SUCCEEDED');
  assert.equal(replay.support,'SUPPORTED');
  assert.equal(replay.coverage,'COMPLETE');
  assert.equal(replay.verdict,'PASS');
  assert.equal(replay.protocol?.amountInRaw,'1000000000000000000');
  assert.equal(replay.protocol?.amountOutRaw,'999496253769344460');
  assert.equal(replay.evidenceDigest,evidence.digest);
  assert.equal(replay.policySource,'SUPPLIED_RETROSPECTIVE');
  assert.equal(replay.observationFinality,'NOT_CHECKED');
  console.log('Observed existing Sepolia swap and reproduced PASS under this public RPC provider and retrospective policy.');
  console.log('No consensus proof, finality refresh or token balance semantics are established.');
} catch (error) {
  const code = error instanceof Error && /^[A-Z][A-Z0-9_]{0,80}$/.test(error.message)
    ? error.message : 'LIVE_EXAMPLE_CHECK_FAILED';
  console.error('Read-only inspection check failed: '+code);
  process.exitCode=1;
}
