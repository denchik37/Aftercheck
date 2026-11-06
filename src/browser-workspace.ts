import {
  MAX_JSON_BYTES, parseJson, canonicalJson, parsePolicy, parseEvidenceAsync,
  verifyEvidenceAsync, decodeExactInputSingle, validateReceiptIdentity,
  quantity, address, hash32, type EvidenceBundle, type Policy, type ReplayReport
} from './browser-engine.ts';
import {decimalToRaw, rawToDecimal, formatAmount, parseDecimals} from './amounts.ts';
import {authenticatedTokenPrecision, type VerifiedTokenPrecision} from './token-precision.ts';
import {createVerificationPackage} from './browser-export.ts';

const RETAINED_TRANSACTION = '0x608ca58e7d01dbe0c7fe48af8c0bb9f2bddcf07ccc36f5c28d033bc8d198d5e9';
const RETAINED_EVIDENCE_PATH = './evidence/sepolia.json';
type PrecisionMode = 'verified' | 'raw' | 'custom';
type Decimals = {input: number | null; output: number | null};
type Precision = {input: VerifiedTokenPrecision | null; output: VerifiedTokenPrecision | null};
type EvaluationRequest = {revision: number; evidence: EvidenceBundle; policy: Policy};

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing workspace element: ${id}`);
  return found as T;
}
const hashInput = element<HTMLInputElement>('transaction-hash');
const fileInput = element<HTMLInputElement>('evidence-file');
const maxInput = element<HTMLInputElement>('max-input');
const minReceived = element<HTMLInputElement>('min-received');
const recipientInput = element<HTMLInputElement>('expected-recipient');
const reserveEnabled = element<HTMLInputElement>('reserve-enabled');
const reserveFloor = element<HTMLInputElement>('reserve-floor');
const policyFields = element<HTMLFieldSetElement>('policy-fields');
const precisionSelect = element<HTMLSelectElement>('precision-mode');
const inputDecimals = element<HTMLInputElement>('input-decimals');
const outputDecimals = element<HTMLInputElement>('output-decimals');
const downloadIds = ['download-package', 'download-evidence', 'download-policy', 'download-report', 'download-markdown'];
const policyInputs = [maxInput, minReceived, recipientInput, reserveFloor];

let revision = 0;
let fetchController: AbortController | null = null;
let evidence: EvidenceBundle | null = null;
let evidenceText: string | null = null;
let evidenceOrigin = '';
let policy: Policy | null = null;
let report: ReplayReport | null = null;
let observedReport: ReplayReport | null = null;
let verifiedPrecision: Precision = {input: null, output: null};
let decimals: Decimals = {input: null, output: null};
let precisionMode: PrecisionMode = 'raw';
let precisionPending = false;
let pendingEvaluation: EvaluationRequest | null = null;
let evaluationRunning = false;
let exportRunning = false;

const setText = (id: string, value: string) => { element(id).textContent = value; };
function rowList(id: string, rows: Array<[string, string]>): void {
  const list = element(id);
  const fragment = document.createDocumentFragment();
  for (const [label, value] of rows) {
    const row = document.createElement('div');
    const term = document.createElement('dt');
    const description = document.createElement('dd');
    term.textContent = label;
    description.textContent = value;
    row.append(term, description);
    fragment.append(row);
  }
  list.replaceChildren(fragment);
}
function listItems(id: string, messages: string[]): void {
  const fragment = document.createDocumentFragment();
  for (const message of messages) {
    const item = document.createElement('li');
    item.textContent = message;
    fragment.append(item);
  }
  element(id).replaceChildren(fragment);
}
function setStep(name: string, state: 'pending' | 'working' | 'done' | 'unavailable'): void {
  const step = element(`step-${name}`);
  step.dataset.state = state;
  step.querySelector('small')!.textContent = {pending: 'Pending', working: 'Working', done: 'Done', unavailable: 'Unavailable'}[state];
}
function clearError(): void {
  element('error').hidden = true;
  setText('error', '');
  for (const input of policyInputs) input.removeAttribute('aria-invalid');
  hashInput.removeAttribute('aria-invalid');
}
function explainError(error: unknown): string {
  const message = error instanceof Error ? error.message : 'The input could not be validated.';
  if (message === 'EVIDENCE_DIGEST_MISMATCH') return 'Evidence integrity check failed: the supplied digest does not match the bundle. No financial result is available.';
  if (message === 'SECURE_CONTEXT_CRYPTO_REQUIRED') return 'Native Web Crypto is required. Open this workspace over HTTPS or localhost.';
  if (message === 'JSON_SIZE_LIMIT') return 'Evidence exceeds the 8 MB size limit.';
  if (message === 'EVIDENCE_TRANSACTION_MISMATCH') return 'The evidence transaction hash does not match the transaction hash entered above.';
  if (message === 'INVALID_UTF8') return 'Evidence must be valid UTF-8 JSON. No replacement characters were introduced.';
  return message;
}
function showError(error: unknown): void {
  for (const step of ['identity', 'evidence', 'integrity', 'route', 'policy', 'report']) {
    if (element(`step-${step}`).dataset.state === 'working') setStep(step, 'unavailable');
  }
  setText('error', explainError(error));
  element('error').hidden = false;
  setText('progress', 'Validation stopped. Correct the input and try again.');
}
function updateDownloadButtons(): void {
  const disabled = report === null || policy === null || evidenceText === null || precisionPending || exportRunning;
  for (const id of downloadIds) element<HTMLButtonElement>(id).disabled = disabled;
}
function invalidateReport(note: string): void {
  report = null;
  pendingEvaluation = null;
  setStep('policy', 'pending');
  setStep('report', 'pending');
  setText('support', 'NO CURRENT RESULT');
  setText('coverage', 'NO CURRENT RESULT');
  setText('verdict', 'NOT EVALUATED');
  element('policy-outcome').dataset.tone = 'neutral';
  setText('verdict-note', note);
  setText('check-count', 'NO CURRENT RESULT');
  listItems('checks', ['No current verification result.']);
  rowList('verification-details', [['Status', 'No current verification result.']]);
  setText('policy-json', 'No current validated policy.');
  setText('report-json', 'No current verification result.');
  setText('export-status', 'A current valid verification result is required.');
  element('comparison').hidden = true;
  updateDownloadButtons();
}
function beginRevision(): number {
  revision++;
  fetchController?.abort();
  fetchController = null;
  clearError();
  invalidateReport('Requirements or evidence changed. Waiting for current validation.');
  return revision;
}
function resetEvidence(): void {
  for (const step of ['identity', 'evidence', 'integrity', 'route', 'policy', 'report']) setStep(step, 'pending');
  setText('replay-notice', 'Historical evidence replay — not a fresh blockchain inspection.');
  setText('execution-label', 'Onchain execution');
  evidence = null;
  evidenceText = null;
  evidenceOrigin = '';
  policy = null;
  observedReport = null;
  verifiedPrecision = {input: null, output: null};
  decimals = {input: null, output: null};
  precisionMode = 'raw';
  precisionPending = false;
  precisionSelect.value = 'raw';
  precisionSelect.disabled = true;
  const verifiedOption = precisionSelect.querySelector<HTMLOptionElement>('option[value="verified"]');
  if (verifiedOption) verifiedOption.disabled = true;
  element('custom-precision').hidden = true;
  policyFields.disabled = true;
  for (const input of policyInputs) input.value = '';
  reserveFloor.value = '0';
  reserveEnabled.checked = false;
  reserveFloor.disabled = true;
  element('reserve-control').hidden = true;
  setText('execution', 'NOT LOADED');
  setText('execution-note', 'Execution and financial policy are evaluated separately.');
  setText('transaction-context', 'No evidence loaded');
  setText('evidence-context', 'LOCAL EVALUATION');
  setText('amount-in', '—');
  setText('amount-out', '—');
  setText('calldata-minimum', '—');
  setText('token-in-caption', 'Input token');
  setText('token-out-caption', 'Output token');
  setText('actuals-note', 'Receipt-scoped amounts appear after validation and supported-route reconciliation.');
  setText('policy-status', 'Requirements become available after evidence validation.');
  rowList('actual-details', [['Status', 'No reconciled swap amounts.']]);
  rowList('evidence-details', [['Status', 'No validated evidence.']]);
  setText('observations-json', 'No evidence loaded.');
  listItems('limitations', ['Load evidence to inspect evaluator limitations.']);
  renderPrecision();
}
function readableQuantity(value: unknown): string {
  try { return `${quantity(value).toString()} (${String(value)})`; }
  catch { return 'Unavailable'; }
}
function display(raw: string, side: 'input' | 'output'): string {
  return decimals[side] === null ? raw : formatAmount(raw, decimals[side], false);
}
function unit(side: 'input' | 'output'): string {
  return decimals[side] === null ? 'raw units' : `token units · ${decimals[side]} decimals`;
}
function renderPrecision(): void {
  setText('input-unit', unit('input'));
  setText('output-unit', unit('output'));
  setText('reserve-unit', unit('input'));
  if (precisionPending) {
    setText('precision-note', 'User-supplied precision is pending. Apply it to reformat the existing raw requirements.');
  } else if (precisionMode === 'verified') {
    setText('precision-note', 'Source-verified precision: 18 decimals for both tokens; matched to retained RPC code at block 7689923. RPC observations are not a consensus proof.');
  } else if (precisionMode === 'custom') {
    setText('precision-note', `User-supplied, unverified precision: input ${decimals.input} decimals; output ${decimals.output} decimals. These values are a display assumption, not authenticated token properties.`);
  } else {
    setText('precision-note', 'Raw token units. No decimal conversion or token-precision assumption is applied.');
  }
}
function writePolicyFields(current: Policy): void {
  maxInput.value = rawToDecimal(current.maxInputRaw, decimals.input ?? 0);
  minReceived.value = rawToDecimal(current.minReceivedRaw, decimals.output ?? 0);
  recipientInput.value = current.expectedRecipient;
  reserveEnabled.checked = current.reserveFloorRaw !== undefined;
  reserveFloor.value = rawToDecimal(current.reserveFloorRaw ?? '0', decimals.input ?? 0);
  element('reserve-control').hidden = !reserveEnabled.checked;
  reserveFloor.disabled = !reserveEnabled.checked;
}
function parseAmountField(input: HTMLInputElement, scale: number | null, label: string): string {
  try { return decimalToRaw(input.value, scale ?? 0); }
  catch (error) {
    input.setAttribute('aria-invalid', 'true');
    throw new Error(`${label}: ${explainError(error)}`);
  }
}
function readPolicyFields(): Policy {
  if (!evidence || !policy) throw new Error('Load supported transaction evidence before setting requirements.');
  const maxInputRaw = parseAmountField(maxInput, decimals.input, 'Maximum input');
  if (maxInputRaw === '0') {
    maxInput.setAttribute('aria-invalid', 'true');
    throw new Error('Maximum input must be greater than zero.');
  }
  const minReceivedRaw = parseAmountField(minReceived, decimals.output, 'Minimum received');
  let recipient: string;
  try { recipient = address(recipientInput.value, 'Expected recipient'); }
  catch (error) { recipientInput.setAttribute('aria-invalid', 'true'); throw error; }
  return parsePolicy({
    schemaVersion: 'aftercheck.policy.v1', chainId: evidence.chainId,
    owner: policy.owner, tokenIn: policy.tokenIn, tokenOut: policy.tokenOut,
    expectedRecipient: recipient, maxInputRaw, minReceivedRaw,
    ...(reserveEnabled.checked ? {reserveFloorRaw: parseAmountField(reserveFloor, decimals.input, 'Reserve floor')} : {})
  });
}
function renderEvidence(): void {
  if (!evidence) return;
  setText('transaction-context', evidence.transactionHash);
  setText('replay-notice', evidence.evidenceClass === 'SYNTHETIC_RPC_FIXTURE' ? 'Synthetic fixture replay — simulated test evidence, not a real-chain observation.' : 'Historical evidence replay — not a fresh blockchain inspection.');
  setText('execution-label', evidence.evidenceClass === 'SYNTHETIC_RPC_FIXTURE' ? 'Simulated execution' : 'Onchain execution');
  setText('evidence-context', evidence.evidenceClass === 'RPC_RECEIPT' ? 'RETAINED RPC OBSERVATIONS' : 'SYNTHETIC TEST FIXTURE');
  rowList('evidence-details', [
    ['Transaction hash', evidence.transactionHash],
    ['Chain ID', String(evidence.chainId)],
    ['Evidence class', evidence.evidenceClass],
    ['Loaded from', evidenceOrigin],
    ['Captured at — as recorded by collector', evidence.acquiredAt],
    ['Block number', readableQuantity(evidence.block?.number)],
    ['Block hash', typeof evidence.block?.hash === 'string' ? evidence.block.hash : 'Unavailable'],
    ['Transaction index', readableQuantity(evidence.transaction?.transactionIndex)],
    ['Evidence digest — canonical SHA-256', evidence.digest],
    ['Integrity', 'Digest checked locally with native Web Crypto'],
    ['Source trust', 'RPC_OBSERVATION_NOT_CONSENSUS_PROOF'],
    ['Observation finality', 'NOT_CHECKED'],
    ['Collection errors', String(evidence.collectionErrors.length)],
    ['Token precision', verifiedPrecision.input && verifiedPrecision.output ? 'Source-verified, pinned runtime; 18 decimals each. Exact capture binding required.' : 'No authenticated token precision for this evidence.'],
    ...(verifiedPrecision.input && verifiedPrecision.output ? [
      ['Input token runtime SHA-256', verifiedPrecision.input.runtimeSha256],
      ['Output token runtime SHA-256', verifiedPrecision.output.runtimeSha256],
      ['Input source record', verifiedPrecision.input.sourceUrl],
      ['Output source record', verifiedPrecision.output.sourceUrl]
    ] as Array<[string, string]> : [])
  ]);
  // Plain text only: evidence can contain attacker-controlled strings.
  setText('observations-json', JSON.stringify({transaction: evidence.transaction, receipt: evidence.receipt, block: evidence.block, canonicalBlockHash: evidence.canonicalBlockHash, rpcChainId: evidence.rpcChainId, state: evidence.state, collectionErrors: evidence.collectionErrors}, null, 2));
}
function renderActuals(): void {
  const actual = observedReport?.protocol;
  if (!actual) return;
  setText('amount-in', display(actual.amountInRaw, 'input'));
  setText('amount-out', display(actual.amountOutRaw, 'output'));
  setText('calldata-minimum', display(actual.amountOutMinimumRaw, 'output'));
  setText('token-in-caption', `Input token · ${actual.tokenIn} · ${unit('input')}`);
  setText('token-out-caption', `Output token · ${actual.tokenOut} · ${unit('output')}`);
  setText('actuals-note', observedReport?.evidenceClass === 'SYNTHETIC_RPC_FIXTURE' ? 'Simulated test amounts reconciled across synthetic Transfer and Swap events. This is not a real-chain observation.' : 'Exact input and output amounts reconciled across the supported receipt Transfer and Swap events.');
  rowList('actual-details', [
    ['Input amount — raw', actual.amountInRaw], ['Output amount — raw', actual.amountOutRaw],
    ['Calldata minimum output — raw', actual.amountOutMinimumRaw],
    ['Input token', actual.tokenIn], ['Output token', actual.tokenOut],
    ['Transaction payer', actual.owner], ['Recorded recipient', actual.recipient],
    ['Router', actual.router], ['Factory', actual.factory], ['Pool', actual.pool],
    ['Protocol profile', actual.profile], ['Pool fee', String(actual.fee)],
    ['Input transfer log index', readableQuantity(actual.logIndices.inputTransfer)],
    ['Output transfer log index', readableQuantity(actual.logIndices.outputTransfer)],
    ['Swap log index', readableQuantity(actual.logIndices.swap)]
  ]);
}
const checkNames: Record<string, string> = {
  owner: 'Transaction payer', recipient: 'Expected recipient', tokenPair: 'Token identities',
  maxInputRaw: 'Maximum input', minReceivedRaw: 'Minimum received', reserveFloorRaw: 'Immediate post-transaction reserve'
};
function renderChecks(current: ReplayReport): void {
  const list = element('checks');
  if (current.checks.length === 0) { listItems('checks', ['No policy checks can be completed for this evidence. Inspect the evidence limits below.']); return; }
  const fragment = document.createDocumentFragment();
  for (const check of current.checks) {
    const item = document.createElement('li');
    const heading = document.createElement('div');
    heading.className = 'check-heading';
    const title = document.createElement('h3');
    title.textContent = checkNames[check.id] ?? check.id;
    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.dataset.tone = check.result.toLowerCase();
    badge.textContent = check.result;
    heading.append(title, badge);
    const id = document.createElement('code');
    id.className = 'check-id';
    id.textContent = check.id;
    const reason = document.createElement('p');
    reason.textContent = check.reason;
    item.append(heading, id, reason);
    fragment.append(item);
  }
  list.replaceChildren(fragment);
}
function renderComparison(current: ReplayReport, currentPolicy: Policy): void {
  const actual = current.protocol;
  if (!actual) return;
  const difference = BigInt(actual.amountOutRaw) - BigInt(currentPolicy.minReceivedRaw);
  const inputDifference = BigInt(actual.amountInRaw) - BigInt(currentPolicy.maxInputRaw);
  const parts: string[] = [];
  if (difference < 0n) parts.push(`Received ${display((-difference).toString(), 'output')} ${unit('output')} below your minimum (${(-difference).toString()} raw units).`);
  else if (difference === 0n) parts.push('The amount received exactly meets your minimum.');
  else parts.push(`Received ${display(difference.toString(), 'output')} ${unit('output')} above your minimum.`);
  if (inputDifference > 0n) parts.push(`Spent ${display(inputDifference.toString(), 'input')} ${unit('input')} above your maximum (${inputDifference.toString()} raw units).`);
  if (currentPolicy.reserveFloorRaw !== undefined) parts.push('The reserve requirement remains UNKNOWN.');
  setText('comparison', parts.join(' '));
  element('comparison').dataset.tone = current.verdict.toLowerCase();
  element('comparison').hidden = false;
}
function renderReport(current: ReplayReport, currentPolicy: Policy): void {
  report = current;
  policy = currentPolicy;
  observedReport = current;
  setText('execution', current.execution);
  setText('execution-note', current.evidenceClass === 'SYNTHETIC_RPC_FIXTURE' ? 'Execution status comes from simulated test evidence, not a real-chain transaction.' : current.execution === 'SUCCEEDED' ? 'The retained receipt records successful transaction execution.' : 'Execution status is derived from the validated receipt identity.');
  setText('support', current.support);
  setText('coverage', current.coverage);
  setStep('route', current.protocol && current.support !== 'UNSUPPORTED' ? 'done' : 'unavailable');
  setStep('policy', 'done');
  setStep('report', 'done');
  setText('verdict', current.verdict);
  element('policy-outcome').dataset.tone = current.verdict.toLowerCase();
  const summary = current.verdict === 'PASS'
    ? 'All requested checks pass under this retained evidence and supplied policy.'
    : current.verdict === 'VIOLATION'
      ? 'At least one requirement is violated.' + (current.checks.some(check => check.result === 'UNKNOWN') ? ' Separate UNKNOWN checks remain unresolved.' : '')
      : 'The evidence cannot establish every requested requirement.';
  setText('verdict-note', summary);
  setText('progress', 'Current requirements evaluated locally. No fresh blockchain inspection occurred.');
  setText('policy-status', 'Edits reevaluate locally. Policy amounts are stored as exact raw integers.');
  setText('check-count', `${current.checks.length} CHECKS · ${current.coverage}`);
  renderActuals();
  renderChecks(current);
  renderComparison(current, currentPolicy);
  listItems('limitations', current.limitations);
  rowList('verification-details', [
    ['Support', current.support], ['Evidence coverage', current.coverage],
    ['Execution', current.execution], ['Financial policy verdict', current.verdict],
    ['Verification mode', current.verificationMode], ['Policy source', current.policySource],
    ['Evaluator version', current.evaluatorVersion], ['Evidence digest', current.evidenceDigest], ['Policy digest', current.policyDigest]
  ]);
  setText('policy-json', canonicalJson(currentPolicy));
  setText('report-json', canonicalJson(current));
  setText('export-status', 'Ready. Export rechecks these exact inputs before creating the download.');
  updateDownloadButtons();
}

/** One crypto-backed evaluation at a time; intermediate edits collapse to the latest request. */
async function drainEvaluations(): Promise<void> {
  if (evaluationRunning) return;
  evaluationRunning = true;
  try {
    while (pendingEvaluation !== null) {
      const request = pendingEvaluation;
      pendingEvaluation = null;
      try {
        const result = await verifyEvidenceAsync(request.evidence, request.policy);
        if (request.revision === revision && evidence === request.evidence && !precisionPending) renderReport(result, request.policy);
      } catch (error) {
        if (request.revision === revision) { invalidateReport('Current inputs could not be verified.'); showError(error); }
      }
    }
  } finally { evaluationRunning = false; }
}
function queueEvaluation(currentRevision: number, currentPolicy: Policy): void {
  if (!evidence || currentRevision !== revision) return;
  policy = currentPolicy;
  setStep('route', observedReport?.protocol ? 'done' : 'working');
  setStep('policy', 'working');
  setText('verdict', 'VERIFYING');
  setText('verdict-note', 'Computing checks for the current requirements.');
  setText('progress', 'Evaluating the current policy locally…');
  setText('policy-status', 'Evaluating current requirements…');
  pendingEvaluation = {revision: currentRevision, evidence, policy: currentPolicy};
  void drainEvaluations();
}
function policyEdited(): void {
  const currentRevision = beginRevision();
  if (!evidence || !policy || precisionPending) return;
  element('reserve-control').hidden = !reserveEnabled.checked;
  reserveFloor.disabled = !reserveEnabled.checked;
  try { queueEvaluation(currentRevision, readPolicyFields()); }
  catch (error) { setText('policy-status', 'Correct the invalid requirement to resume evaluation.'); showError(error); }
}

async function acceptEvidence(text: string, expectedHash: string, currentRevision: number, origin: string): Promise<void> {
  if (currentRevision !== revision) return;
  setStep('evidence', 'done');
  setStep('integrity', 'working');
  setText('progress', 'Validating evidence schema and SHA-256 digest…');
  const accepted = await parseEvidenceAsync(parseJson(text));
  if (currentRevision !== revision) return;
  setStep('integrity', 'done');
  if (hash32(accepted.transactionHash) !== expectedHash) { setStep('identity', 'unavailable'); throw new Error('EVIDENCE_TRANSACTION_MISMATCH'); }
  setStep('identity', 'working');
  setText('progress', 'Checking retained token precision and transaction identities…');
  const authenticated = await authenticatedTokenPrecision(accepted);
  if (currentRevision !== revision) return;
  evidence = accepted;
  evidenceText = text;
  evidenceOrigin = origin;
  verifiedPrecision = authenticated;
  const identity = validateReceiptIdentity(accepted);
  setStep('identity', identity.coverage === 'COMPLETE' ? 'done' : 'unavailable');
  setText('execution', identity.execution);
  setText('execution-note', identity.reason ?? 'Execution is derived from the retained transaction and receipt identities.');
  renderEvidence();
  let initialPolicy: Policy;
  try {
    const decoded = decodeExactInputSingle(accepted.transaction?.input);
    initialPolicy = parsePolicy({
      schemaVersion: 'aftercheck.policy.v1', chainId: accepted.chainId,
      owner: address(accepted.transaction?.from, 'Transaction payer'), expectedRecipient: decoded.recipient,
      tokenIn: decoded.tokenIn, tokenOut: decoded.tokenOut,
      maxInputRaw: decoded.amountInRaw, minReceivedRaw: decoded.amountOutMinimumRaw
    });
  } catch {
    setStep('route', 'unavailable');
    setText('support', 'UNSUPPORTED');
    setText('coverage', identity.coverage);
    setText('verdict', 'UNKNOWN');
    element('policy-outcome').dataset.tone = 'unknown';
    setText('verdict-note', 'A supported exactInputSingle policy cannot be seeded from this evidence.');
    setText('policy-status', 'Requirements unavailable: no supported transaction input can be decoded.');
    setText('progress', 'Evidence integrity checked. No supported financial result is available.');
    listItems('limitations', [identity.reason ?? 'This transaction cannot be decoded as a supported direct exactInputSingle swap. No financial claims are made.']);
    return;
  }
  policy = initialPolicy;
  precisionMode = authenticated.input && authenticated.output ? 'verified' : 'raw';
  decimals = precisionMode === 'verified' ? {input: authenticated.input!.decimals, output: authenticated.output!.decimals} : {input: null, output: null};
  precisionSelect.value = precisionMode;
  precisionSelect.disabled = false;
  const verifiedOption = precisionSelect.querySelector<HTMLOptionElement>('option[value="verified"]');
  if (verifiedOption) verifiedOption.disabled = !authenticated.input || !authenticated.output;
  inputDecimals.value = String(authenticated.input?.decimals ?? 0);
  outputDecimals.value = String(authenticated.output?.decimals ?? 0);
  policyFields.disabled = false;
  writePolicyFields(initialPolicy);
  renderPrecision();
  setText('policy-status', 'Starting requirements use the transaction input amount, calldata minimum, and recorded recipient. Edit them to define your policy.');
  queueEvaluation(currentRevision, initialPolicy);
}
function decodeUtf8(bytes: ArrayBuffer | Uint8Array): string {
  try { return new TextDecoder('utf-8', {fatal: true, ignoreBOM: true}).decode(bytes); }
  catch { throw new Error('INVALID_UTF8'); }
}
async function readBoundedResponse(response: Response): Promise<string> {
  const statedSize = response.headers.get('content-length');
  if (statedSize && /^[0-9]+$/.test(statedSize) && BigInt(statedSize) > BigInt(MAX_JSON_BYTES)) throw new Error('JSON_SIZE_LIMIT');
  if (!response.body) throw new Error('The retained evidence response has no body.');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_JSON_BYTES) throw new Error('JSON_SIZE_LIMIT');
      chunks.push(value);
    }
  } catch (error) { await reader.cancel(); throw error; }
  finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let at = 0;
  for (const chunk of chunks) { bytes.set(chunk, at); at += chunk.length; }
  return decodeUtf8(bytes);
}
async function loadRetainedEvidence(): Promise<void> {
  const currentRevision = beginRevision();
  resetEvidence();
  try {
    let expectedHash: string;
    try { expectedHash = hash32(hashInput.value, 'Transaction hash'); }
    catch (error) { hashInput.setAttribute('aria-invalid', 'true'); throw error; }
    if (expectedHash !== RETAINED_TRANSACTION) throw new Error('No retained evidence is available for this transaction. Import a local evidence JSON file for the entered hash.');
    setStep('evidence', 'working');
    setText('progress', 'Loading the retained Sepolia evidence file…');
    const controller = new AbortController();
    fetchController = controller;
    const response = await fetch(RETAINED_EVIDENCE_PATH, {signal: controller.signal, credentials: 'omit', redirect: 'error', cache: 'no-store'});
    if (currentRevision !== revision) return;
    if (!response.ok) throw new Error(`Retained evidence could not be loaded (HTTP ${response.status}). You can import the saved evidence JSON locally.`);
    const text = await readBoundedResponse(response);
    if (currentRevision !== revision) return;
    await acceptEvidence(text, expectedHash, currentRevision, 'Published retained Sepolia capture');
  } catch (error) {
    if (currentRevision === revision) { invalidateReport('Evidence could not be loaded or validated.'); showError(error); }
  } finally { if (currentRevision === revision) fetchController = null; }
}
async function importEvidence(): Promise<void> {
  const file = fileInput.files?.[0];
  if (!file) return;
  const currentRevision = beginRevision();
  resetEvidence();
  try {
    let expectedHash: string;
    try { expectedHash = hash32(hashInput.value, 'Transaction hash'); }
    catch (error) { hashInput.setAttribute('aria-invalid', 'true'); throw error; }
    if (file.size > MAX_JSON_BYTES) throw new Error('JSON_SIZE_LIMIT');
    setStep('evidence', 'working');
    setText('progress', 'Reading the local evidence file…');
    const bytes = await file.arrayBuffer();
    if (currentRevision !== revision) return;
    await acceptEvidence(decodeUtf8(bytes), expectedHash, currentRevision, `Local file: ${file.name}`);
  } catch (error) {
    if (currentRevision === revision) { invalidateReport('Imported evidence could not be validated.'); showError(error); }
  } finally { fileInput.value = ''; }
}
function changePrecisionMode(): void {
  if (!evidence || !policy) return;
  const requested = precisionSelect.value as PrecisionMode;
  const wasPending = precisionPending;
  const currentRevision = beginRevision();
  let preservedPolicy: Policy;
  try { preservedPolicy = wasPending ? policy : readPolicyFields(); }
  catch (error) { precisionSelect.value = precisionMode; showError(error); return; }
  policy = preservedPolicy;
  if (requested === 'custom') {
    precisionPending = true;
    element('custom-precision').hidden = false;
    policyFields.disabled = true;
    inputDecimals.value = String(decimals.input ?? verifiedPrecision.input?.decimals ?? 0);
    outputDecimals.value = String(decimals.output ?? verifiedPrecision.output?.decimals ?? 0);
    setText('verdict-note', 'Apply the pending display precision to resume evaluation.');
    setText('progress', 'Choose user-supplied token decimals, then apply. Existing raw requirements are preserved.');
    renderPrecision();
    return;
  }
  if (requested === 'verified' && (!verifiedPrecision.input || !verifiedPrecision.output)) {
    precisionSelect.value = precisionMode;
    showError(new Error('Source-verified precision is unavailable for this evidence.'));
    return;
  }
  precisionPending = false;
  precisionMode = requested;
  decimals = requested === 'verified' ? {input: verifiedPrecision.input!.decimals, output: verifiedPrecision.output!.decimals} : {input: null, output: null};
  element('custom-precision').hidden = true;
  policyFields.disabled = false;
  writePolicyFields(preservedPolicy);
  renderPrecision();
  renderActuals();
  queueEvaluation(currentRevision, preservedPolicy);
}
function customPrecisionEdited(): void {
  if (!evidence || !policy || precisionSelect.value !== 'custom') return;
  // Capture any existing requirements before locking their editable display.
  const preservedPolicy = precisionPending ? policy : (() => { try { return readPolicyFields(); } catch { return null; } })();
  beginRevision();
  if (!preservedPolicy) { showError(new Error('Correct the current requirements before changing precision.')); return; }
  policy = preservedPolicy;
  precisionPending = true;
  policyFields.disabled = true;
  setText('verdict-note', 'Apply the pending display precision to resume evaluation.');
  setText('progress', 'Display precision changed. Apply it to preserve and reformat the raw requirements.');
  renderPrecision();
}
function applyCustomPrecision(): void {
  if (!evidence || !policy || precisionSelect.value !== 'custom') return;
  const currentRevision = beginRevision();
  try {
    const preservedPolicy = precisionPending ? policy : readPolicyFields();
    const nextDecimals = {input: parseDecimals(inputDecimals.value), output: parseDecimals(outputDecimals.value)};
    decimals = nextDecimals;
    precisionMode = 'custom';
    precisionPending = false;
    policyFields.disabled = false;
    writePolicyFields(preservedPolicy);
    renderPrecision();
    renderActuals();
    queueEvaluation(currentRevision, preservedPolicy);
  } catch (error) { showError(error); }
}
function saveDownload(name: string, data: string | Uint8Array, mimeType: string): void {
  const content = typeof data === 'string' ? data : new Uint8Array(data).buffer;
  const url = URL.createObjectURL(new Blob([content], {type: mimeType}));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.hidden = true;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function download(fileName?: string): Promise<void> {
  if (!report || !policy || !evidenceText || precisionPending || exportRunning) return;
  const currentRevision = revision;
  const snapshot = {evidenceText, policy, report, displayDecimals: {...decimals}};
  exportRunning = true;
  updateDownloadButtons();
  setText('export-status', 'Rechecking evidence, policy, and report before packaging…');
  try {
    const result = await createVerificationPackage(snapshot);
    if (currentRevision !== revision || report !== snapshot.report) return;
    if (fileName) saveDownload(fileName, result.files[fileName], fileName.endsWith('.json') ? 'application/json;charset=utf-8' : 'text/markdown;charset=utf-8');
    else saveDownload('aftercheck-verification.zip', result.zip, 'application/zip');
    setText('export-status', 'Download created from the current evidence, policy, and verifier result.');
  } catch (error) {
    if (currentRevision === revision) { setText('export-status', 'Export stopped. No package was downloaded.'); showError(error); }
  } finally { exportRunning = false; updateDownloadButtons(); }
}
function selectTab(tab: HTMLButtonElement, focus = false): void {
  for (const other of document.querySelectorAll<HTMLButtonElement>('[role="tab"]')) {
    const selected = other === tab;
    other.setAttribute('aria-selected', String(selected));
    other.tabIndex = selected ? 0 : -1;
    element(other.getAttribute('aria-controls')!).hidden = !selected;
  }
  if (focus) tab.focus();
}
const tabs = Array.from(document.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
for (const tab of tabs) {
  tab.addEventListener('click', () => selectTab(tab));
  tab.addEventListener('keydown', event => {
    const index = tabs.indexOf(tab);
    const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length
      : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length
      : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : null;
    if (next !== null) { event.preventDefault(); selectTab(tabs[next], true); }
  });
}
element('load-evidence').addEventListener('click', () => { void loadRetainedEvidence(); });
element('use-example').addEventListener('click', () => { hashInput.value = RETAINED_TRANSACTION; void loadRetainedEvidence(); });
hashInput.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); void loadRetainedEvidence(); } });
hashInput.addEventListener('input', () => { beginRevision(); resetEvidence(); setText('progress', 'Transaction changed. Load matching evidence to continue.'); });
fileInput.addEventListener('change', () => { void importEvidence(); });
for (const input of policyInputs) input.addEventListener('input', policyEdited);
reserveEnabled.addEventListener('change', policyEdited);
precisionSelect.addEventListener('change', changePrecisionMode);
inputDecimals.addEventListener('input', customPrecisionEdited);
outputDecimals.addEventListener('input', customPrecisionEdited);
element('apply-precision').addEventListener('click', applyCustomPrecision);
element('download-package').addEventListener('click', () => { void download(); });
for (const [id, name] of [['download-evidence', 'evidence.json'], ['download-policy', 'policy.json'], ['download-report', 'report.json'], ['download-markdown', 'report.md']]) {
  element(id).addEventListener('click', () => { void download(name); });
}
updateDownloadButtons();
