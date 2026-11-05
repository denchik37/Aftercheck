import {mkdir, writeFile} from 'node:fs/promises';
import {RpcClient} from '../src/rpc.ts';
import {collectSupportedEvidence} from '../src/collect.ts';

// This optional workflow uses a fixed public, credential-free provider. It never
// accepts wallet keys, provider URLs, or signing instructions from workflow input.
const PUBLIC_SEPOLIA_RPC = 'https://ethereum-sepolia-rpc.publicnode.com';
const MAX_EXPORT_BYTES = 1_000_000;

try {
  const args = process.argv.slice(2);
  if (args.length !== 1 || !/^0x[0-9a-fA-F]{64}$/.test(args[0])) {
    throw new Error('INVALID_TRANSACTION_HASH');
  }
  const transactionHash = args[0].toLowerCase();
  const client = new RpcClient(PUBLIC_SEPOLIA_RPC);
  const evidence = await collectSupportedEvidence(client, transactionHash);
  const json = JSON.stringify(evidence, null, 2) + '\n';
  if (Buffer.byteLength(json, 'utf8') > MAX_EXPORT_BYTES) {
    throw new Error('CAPTURE_EXPORT_TOO_LARGE');
  }
  await mkdir('output', {recursive: true, mode: 0o700});
  await writeFile('output/captured-evidence.json', json, {mode: 0o600});
  // Bounded structured observations are also available through the Actions log
  // API. JSON encoding prevents imported strings from creating workflow commands.
  console.log('AFTERCHECK_EVIDENCE_BEGIN');
  process.stdout.write(json);
  console.log('AFTERCHECK_EVIDENCE_END');
  console.log('Captured RPC observations. Collection alone establishes no policy verdict or Ethereum consensus proof.');
} catch (error) {
  // Never emit an arbitrary provider response, endpoint, error stack, or body.
  const code = error instanceof Error && /^[A-Z][A-Z0-9_]{0,63}$/.test(error.message)
    ? error.message : 'CAPTURE_FAILED';
  console.error(`Capture failed: ${code}`);
  process.exitCode = 1;
}
