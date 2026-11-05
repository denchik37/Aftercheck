#!/usr/bin/env node
import {resolve} from 'node:path';
import {evaluate} from '../src/evaluate.ts';
import {parsePolicy} from '../src/policy.ts';
import {renderMarkdown} from '../src/report.ts';
import {readJsonFile} from '../src/io.ts';
import {canonicalJson} from '../src/json.ts';
import {writeOutputDirectory} from '../src/output.ts';

const usage = `Aftercheck — read-only, receipt-scoped swap inspection

Collect: AFTERCHECK_RPC_URL=<local environment value> npm run cli -- collect <tx-hash> [output-directory]
Replay:  npm run cli -- verify <evidence.json> <policy.json> [output-directory]
Fixture: npm run cli -- <synthetic-observation.json> <policy.json> [output-directory]

Replay needs no network. Policies are retrospective. PASS concerns supported
receipt-emitted amounts under stated assumptions, never account balance safety.
Verify exit codes: 0 PASS, 2 VIOLATION, 3 UNKNOWN, 1 invalid input.
Collect exit 0 only means collection completed; it is not a policy verdict.`;

const json = value => canonicalJson(value) + '\n';

try {
  const args=process.argv.slice(2);
  if (args.length===1 && ['--help','-h'].includes(args[0])) console.log(usage);
  else if (args[0]==='collect') {
    if (args.length<2 || args.length>3) throw new Error('INVALID_COLLECT_ARGUMENTS');
    const endpoint=process.env.AFTERCHECK_RPC_URL;
    if (!endpoint) throw new Error('AFTERCHECK_RPC_URL_REQUIRED');
    const [{RpcClient},{collectSupportedEvidence},{validateReceiptIdentity}]=await Promise.all([
      import('../src/rpc.ts'),import('../src/collect.ts'),import('../src/evidence.ts')
    ]);
    const evidence=await collectSupportedEvidence(new RpcClient(endpoint),args[1]);
    const out=resolve(args[2]??'aftercheck-output');
    await writeOutputDirectory(out,{'evidence.json':json(evidence)});
    const identity=validateReceiptIdentity(evidence);
    const stateErrors=evidence.state.filter(item=>item.error!==undefined).length;
    console.log(`Saved evidence.json. execution=${identity.execution} identity=${identity.coverage} unavailableStateReads=${stateErrors}`);
    console.log('Collection is not a policy verdict. Use verify with a separate declared policy.');
    process.exitCode=identity.coverage==='COMPLETE'&&stateErrors===0?0:3;
  } else {
    const replay=args[0]==='verify';
    const values=replay?args.slice(1):args;
    if (values.length<2 || values.length>3) throw new Error('INVALID_ARGUMENTS');
    const [observationFile,policyFile,outDirectory='aftercheck-output']=values;
    const observation=await readJsonFile(resolve(observationFile));
    const policy=parsePolicy(await readJsonFile(resolve(policyFile),64_000));
    const report=replay ? (await import('../src/verify.ts')).verifyEvidence(observation,policy) : evaluate(observation,policy);
    const out=resolve(outDirectory);
    // The normalized retrospective policy remains separate from evidence and
    // is never sent to an RPC provider.
    const files={'policy.json':json(policy),'report.json':json(report),'report.md':renderMarkdown(report)};
    if(replay)files['evidence.json']=json(observation);
    await writeOutputDirectory(out,files);
    console.log(`[${report.evidenceClass}] execution=${report.execution} support=${report.support} evidence=${report.coverage} verdict=${report.verdict}`);
    console.log(`Saved report.json and report.md in ${out}`);
    process.exitCode=report.verdict==='PASS'?0:report.verdict==='VIOLATION'?2:3;
  }
} catch(error) {
  // Imported text and provider exception bodies are not emitted on failure.
  const raw=error instanceof Error?error.message:'';
  const code=/^[A-Z][A-Z0-9_]{0,80}$/.test(raw)?raw:'INVALID_INPUT';
  console.error(`Unable to evaluate input: ${code}`);
  console.error('No new complete output was published. Existing output, if any, belongs to an earlier run.');
  if(code==='OUTPUT_ROLLBACK_FAILED')console.error('Previous files remain in a sibling .aftercheck-backup-* directory under previous; preserve that backup for recovery.');
  process.exitCode=1;
}
