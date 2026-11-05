# Sepolia USDC/WETH token compatibility

**Issue [#24](https://github.com/denchik37/aftercheck/issues/24) · 6 November 2026 IST**

## Executive decision: GO for token and receipt compatibility

**The selected Circle test-USDC and Sepolia WETH contracts are sufficiently
authenticated and compatible with Aftercheck's existing direct-swap receipt profile
to justify considering one separately authorized controlled testnet attempt.**

The deployed proxy/WETH programs were independently recompiled in full; the USDC
implementation's executable program was independently reproduced with a documented
metadata-only mismatch. Pinned current and historical runtime observations match
those authenticated programs. A genuine third-party swap of the exact selected pair
was collected and passed the unchanged receipt adapter with complete required state
observations. No verifier expansion was needed.

This closes Issue #24's token/receipt research gate. It does **not** establish wallet
readiness, grant execution authority, guarantee a future transaction, or prove
immediate balances. **Receipt-emitted amounts under the documented plain-token
assumption** remains the financial claim boundary. No new reserve PASS is permitted.

Work started from `main` at `3835c5a933c1f3f493ff726dd3b597f68c8c6330`.
Issue #24, merged PR #23, the existing feasibility report/probe, production adapter,
collector, evidence validator, protocol documentation and tests were inspected.
There were no open PRs or pre-existing token-semantics branch at the initial check.
[Main CI run 42109773947](https://github.com/denchik37/aftercheck/actions/runs/42109773947)
passed; inspected logs contain 165 Node tests and 75 browser checks. A fresh local
`npm ci --ignore-scripts --no-audit --no-fund` and `npm run verify` also passed all
165 baseline tests. Those are baseline checks, not proof of new research findings.

## Exact identities

| Role | Ethereum Sepolia (`11155111`) address |
|---|---|
| Circle test USDC / proxy | `0x1c7d4b196cb0c7b01d743fbc6116a902379c7238` |
| Observed USDC implementation | `0xda317c1d3e835dd5f1be459006471acaa1289068` |
| WETH9 | `0xfff9976782d46cc05630d1f6ebab18b2324d6b14` |
| SwapRouter02 | `0x3bfa4769fb09eefc5a80d6e87c3b9c650f7ae48e` |
| v3 factory | `0x0227628f3f023bb0b980b67d528571c95c6dac1c` |
| Selected pool / fee | `0x3289680dd4d6c10bb19b899729cda5eef58aeff1` / `500` |

[Circle's official address table](https://developers.circle.com/stablecoins/usdc-contract-addresses)
identifies the test-USDC address and states that test tokens have no financial value
or real-USD backing. [Uniswap's official deployment table](https://developers.uniswap.org/docs/protocols/v3/deployments/v3-ethereum-deployments)
identifies this WETH9, Router02 and factory. Both were checked during this investigation.

## Source-to-runtime authentication

Public [Sourcify API v2](https://docs.sourcify.dev/docs/api/) records were retrieved for
the exact chain/addresses. Their standard compiler inputs were compiled locally in
isolated temporary directories, without changing Aftercheck's dependencies.

| Contract | Compiler and settings | Independently reproduced comparison |
|---|---|---|
| FiatTokenProxy | Solidity `0.6.12+commit.27d51765`, optimizer enabled / 10,000,000 runs, Istanbul | Full 1,798-byte runtime identical to the verification record |
| FiatTokenV2_2 | Same compiler/settings; linked SignatureChecker `0x36939d5a1ca73901058f3fa2ba0b7546e7144d7a` | Executable 23,411-byte prefix identical; full 23,464-byte runtime differs in 32 bytes of trailing IPFS metadata |
| WETH9 | Solidity `0.4.19+commit.c4cbbb05`, optimizer disabled | Full 3,124-byte runtime identical to the verification record |

The implementation is a Sourcify **`match`**, not `exact_match`. Its only differing
bytes occupy offsets 23421–23452, within the final 53-byte CBOR metadata trailer.
The executable prefix, including linked library addresses, is identical. No arbitrary
byte stripping, library replacement or claim of a full metadata match is made.
The linked signature library is used by authorization/permit paths; the ordinary
`transfer`/`transferFrom` path under review does not call it.

Runtime SHA-256 values below hash the raw bytes, not their hexadecimal text:

| Contract | Recorded onchain runtime SHA-256 |
|---|---|
| Proxy | `846efa39d1689bdcffea1cdabe788d0b6f81050c0667ad6444e722aed27f7e86` |
| Implementation | `eb2726ec3ac0cb69704b0d37e7076470f47e87c6eaac452f173d58c607b4265f` |
| WETH9 | `9bbda01ae25d1f2b4171918cc6280a5769d6d6fc5500ed01e2143697902df4e1` |

The implementation executable-prefix SHA-256 is
`6991ce72b9df21fdce5bce22a97d84aa005102fadd702f8b75bd8bf70a703ddc`.
The separate [research manifest](evidence/sepolia-token-semantics.json) retains the
runtime bytes, source-response hashes, exact verification URLs and compiler evidence.
Matching these records is source authentication under the stated compiler/service
trust; a pinned public RPC comparison is a separate required observation.

## USDC proxy identity

The authenticated FiatTokenProxy uses **legacy ZeppelinOS unstructured slots**:

- Implementation: `0x7050c9e0f4ca769c69bd3a8ef740bc37934f8e2c036e5a723fd8ee048ed3f8c3`, the hash of `org.zeppelinos.proxy.implementation`.
- Admin: `0x10d6a54a4754c8869d6886b5f5d7fbfa5b4522237ea5c60d11bc4e7a1ff9390b`, the hash of `org.zeppelinos.proxy.admin`.

These are not EIP-1967 slots. The source exposes public `implementation()` and
`admin()` getters; both can be cross-checked against storage without impersonation.
At discovery block **12072153**, hash
`0x352955965bd5c16126a36944c5d9ebd332611da0f2312196cd1f23ba159c18cf`,
the implementation getter and legacy slot independently returned the implementation
above. Admin getter and slot both returned
`0xd48f3032f64e3127883fda62bc2c47c698d6baf7`.
These are provider-dependent block-end observations, not transaction-boundary state
proofs. They do not establish the implementation at earlier blocks.

## Committed pinned observations

The committed probe at `e5a26b08aa3a4757087f64aece5d8d21f7bd87ba` completed two
independent captures, each with **20 successful read-only requests and zero errors**:

| Capture | Block and hash | Acquisition interval (UTC) |
|---|---|---|
| Historical containing block | `12070596` / `0xf6e12d492ab92cd27c63da5cb20dc61f21751825afe83324ead31eb9f8756d26` | `2026-11-05T21:43:11.859Z`–`21:43:49.658Z` |
| Current observation | `12072216` / `0xd1446030d1c5b15226929451e952c4c3aad414765f3fcd8f3d2f857323ffc5b1` | `2026-11-05T21:43:49.658Z`–`21:44:26.814Z` |

Every runtime code hash matched the table above; both legacy slots agreed with their
public getters. Final canonical block and chain checks passed independently for
each capture. These are separate public Tenderly observations; no values from one
block were substituted into the other.

At **both** blocks, USDC `paused()` was false, the fixed Router02 and pool were not
blacklisted, and token decimals were `6` / `18`. The implementation and admin were
the addresses above. Other configured roles agreed at both blocks:

| Role | Observed address |
|---|---|
| Token owner and pauser | `0xab7dbf0fc9d32349c484419073098dcd52c14798` |
| Blacklister | `0x9d2e76e96b295f45f2f5b02a6b150526be94a66d` |
| Master minter | `0x4b22a317731c7b744b00038ab782f4c54d152ddb` |

The future owner's identity and blacklist/balance/allowance state remain unset.
Historical implementation reads describe the end of the containing block, not an
independent proof of the exact implementation at the target transaction boundary.

## Transfer paths and administrative controls

The authenticated deployed `FiatTokenV1` functions are inherited unchanged by
`FiatTokenV2_2`. Ordinary `transferFrom(from,to,value)` requires an unpaused token,
unblocked caller/from/to, sufficient allowance and sufficient balance. It debits
and credits exactly `value`, emits one `Transfer`, decrements allowance silently,
and returns ABI `true`. Even maximum allowance is decremented: this implementation
has no unlimited-allowance exemption. The proxy's fallback adds no event; delegated
execution emits the token log from the **proxy address**.

The reviewed transfer path has no transfer fee, rebase, receiver hook or external
recipient callback. V2.2 packs the blacklist bit above a 255-bit balance and rejects
an overflowing balance. This is a source-level conclusion about the authenticated
program, not a proof extracted from its event names. An explicit approval emits
`Approval`; authorization, mint/burn and administrative entry points have their
own events. They are not invoked by the proposed ordinary input payment.

USDC remains mutable. The proxy admin can upgrade and change admin; the token owner
can replace the pauser, blacklister and master minter. The pauser can stop transfers;
the blacklister can block participants. For the input leg, the checked participants
must include **Router02 as caller, the actual sender, and the pool**. Public role
addresses identify configured authorities, not the people or mechanisms controlling
them. [Circle's official source](https://github.com/circlefin/stablecoin-evm/blob/fc85788bc7c23cefe3df1a757133048bfddadeaa/contracts/v1/FiatTokenV1.sol)
and [proxy source](https://github.com/circlefin/stablecoin-evm/blob/fc85788bc7c23cefe3df1a757133048bfddadeaa/contracts/upgradeability/AdminUpgradeabilityProxy.sol)
provide context; that current upstream revision is **not asserted to be the deployed
source revision**. The deployed binding comes from recompiling verified source
inputs identified and hashed in the manifest.

WETH9 is a standalone non-upgradeable contract in the authenticated source/runtime.
Its `transfer` delegates internally to `transferFrom`; ordinary transfers debit and
credit the same raw amount, emit one `Transfer`, and return `true`. Finite third-party
allowance decreases without `Approval`; maximum allowance remains unchanged.
Its ordinary transfer path has no fee, rebasing, pause/blocklist, upgrade control or
recipient hook. `deposit`/payable fallback emit `Deposit`, and `withdraw` emits
`Withdrawal` and sends native ETH. The proposed route uses neither: **native value
stays zero and the output remains WETH**.

## Genuine historical receipt and unchanged adapter replay

The bounded discovery queried exactly two 2,000-block ranges, with the selected pool,
Swap topic and indexed Router02 sender fixed. It returned 48 matching Swap logs;
15 positive-USDC-input transaction candidates were inspected. Four called Router02
directly; eleven called other contracts and were not treated as supported. Discovery
used 25 public read-only requests with no RPC failures. Its `eth_getLogs` calls were
isolated research; the production RPC allowlist remains unchanged.

The strongest selected transaction was then collected independently through the
**unchanged production collector**, including all twelve historical protocol-state
observations, EOA code check, block membership and final canonical/chain rechecks.

| Field | Actual observation |
|---|---|
| Transaction | [`0x43507127d3dc456b9f04f8d303268ae908a3620f08c05a30265567f74e61468d`](https://sepolia.etherscan.io/tx/0x43507127d3dc456b9f04f8d303268ae908a3620f08c05a30265567f74e61468d) |
| Chain / block / index | `11155111` / `12070596` (`0xb82ec4`) / `0x72` |
| Block hash | `0xf6e12d492ab92cd27c63da5cb20dc61f21751825afe83324ead31eb9f8756d26` |
| Block timestamp | `2026-11-05T16:14:12Z` |
| Sender and recipient | `0x1ef24506bbab74c2e99e8b8cbea63ec6d343834f` |
| Call | Direct Router02, selector `0x04e45aaf`, selected token pair, fee `500` |
| Type / native value / price limit | `0x2` / `0` / `0` |
| Input / output raw | `25000000` / `945281192884240` |
| Router minimum raw | `0` (historical fact, not a proposed safe minimum) |
| Capture | `2026-11-05T21:36:28.889Z`–`2026-11-05T21:38:06.784Z` |
| Provider / requests | Public keyless Tenderly / `19`, all successful |
| Collector source | `3835c5a933c1f3f493ff726dd3b597f68c8c6330`; imported production files unchanged |

The **entire receipt** contains these three logs, with no Approval or extra activity:

| Index | Event | Participants | Raw quantity |
|---|---|---|---|
| `0xf9` | WETH `Transfer` | Pool → recipient | `945281192884240` |
| `0xfa` | USDC `Transfer` | Sender → pool | `25000000` |
| `0xfb` | Pool `Swap` | Router02 / recipient | `amount0=25000000`, `amount1=-945281192884240` |

All log/transaction/receipt identities agree. The exact calldata input equals the
input Transfer and positive signed pool input; output Transfer equals negative
signed pool output. Order matches output payment → input callback → Swap.

The unchanged verifier returned **SUCCEEDED / SUPPORTED / COMPLETE / PASS** under a
retrospectively derived **compatibility-only** policy (actual participants/pair,
input cap `25000000`, output minimum `0`). This is not an independently predeclared
financial policy, an owner-executed experiment, a loss incident or a new transaction.
Adding `reserveFloorRaw: "0"` returns **UNKNOWN / PARTIAL**, with the reserve check
UNKNOWN. The evidence digest is
`0x2085ade6fc6fdf6421df10d384492f32994b5ba1a0e296c312054d2a2f1f1171`.

The manifest embeds the exact 172,438-byte canonical capture using `zlib+base64` to
avoid duplicating large contract bytecode in several JSON sections. It includes the
original file SHA-256, digest, readable transaction/receipt, retrospective policy,
source hashes and replay results. Decompression reconstructs the original bytes;
replay checks them without contacting any server. This new research capture does not
replace or modify the existing genuine public example.

The other three direct transaction candidates are recorded in the discovery manifest
summary. Only the selected transaction received complete collector verification.
Do not extend its coverage to the other three.

## Compatibility versus financial state

| Proposition | Supported conclusion |
|---|---|
| Standard token transfer paths | Authenticated deployed programs support ordinary exact-amount transfers with the restrictions above |
| Supported complete receipt | Observed in a genuine included third-party transaction; replayed through the unchanged adapter |
| Extra input Approval | Existing adapter permits at most one ordinary sender/router Approval inside the payment callback; neither authenticated ordinary token path emits it here |
| More transfers/swaps, Deposit/Withdrawal, unrelated events | Remain unsupported; no verifier relaxation |
| Current or historical block-end implementation | Must be tied to its own pinned state observation; never inferred from the token symbol or another block |
| Exact implementation at the transaction boundary | Not independently proven by a block-end getter/code read; an intra-block upgrade is not excluded by that read alone |
| Immediate balances/reserves | UNKNOWN; receipt logs are not independent state proofs |
| Future transfer behavior or transaction success | Not guaranteed; upgrades/configuration and execution conditions can change |

## Read-only tooling and reproducibility

`scripts/check-sepolia-token-semantics.mjs` is a separate research probe. It fixes
the three code addresses, two legacy proxy slots, and permitted getters; validates
ABI widths/padding; compares complete runtime hashes; cross-checks getters/storage;
and rechecks chain and canonical block. An unexpected implementation is rejected
without following its address. It never returns a financial PASS or execution-ready
status. The receipt helper reuses the unchanged production parser/verifier with a
retrospective route-compatibility policy and labels synthetic data separately.

The isolated transport admits five methods: `eth_chainId`, `eth_getBlockByNumber`,
`eth_getCode`, `eth_getStorageAt` and `eth_call`. All state reads use
`{blockHash,requireCanonical:true}`. Requests have fixed targets/calldata, no caller
overrides or state overrides, at most 32 requests, at most 15 seconds per request,
120 seconds total, 1 MB per response and 4 MB aggregate. A normal probe uses 20
requests. Provider text and endpoint details do not enter errors. Production
`RpcClient` remains unchanged and still rejects storage reads.

From the repository root, Node 24:

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm run verify
npm run demo
node --test test/sepolia-token-semantics.test.mjs
node scripts/check-sepolia-token-semantics.mjs --json
node scripts/check-sepolia-token-semantics.mjs --json --block=0xb82ec4
node scripts/check-sepolia-token-semantics.mjs --json --block=0xb83518
```

The CLI defaults to the public keyless Tenderly endpoint. `AFTERCHECK_RPC_URL` can
select a provider locally but is never written to probe output. Where the execution
environment requires an HTTP proxy, use Node's `--use-env-proxy` flag; that flag was
used for the recorded live probe. Failed reads remain INCOMPLETE/UNKNOWN. Do not
replace a failed historical read with a current-state answer.

To extract and replay the exact retained capture **offline**:

```bash
node --input-type=module <<'JS'
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {inflateSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {assessSelectedReceipt} from './scripts/check-sepolia-token-semantics.mjs';
const m = JSON.parse(fs.readFileSync('docs/evidence/sepolia-token-semantics.json'));
const h = m.historicalReplay;
const bytes = inflateSync(Buffer.from(h.evidenceZlibBase64, 'base64'), {maxOutputLength: 1000000});
assert.equal(createHash('sha256').update(bytes).digest('hex'), h.evidenceFileSha256);
fs.mkdirSync('output/token-semantics', {recursive: true});
fs.writeFileSync('output/token-semantics/evidence.json', bytes);
fs.writeFileSync('output/token-semantics/policy.json', JSON.stringify(h.policy, null, 2) + '\n');
console.log(assessSelectedReceipt(JSON.parse(bytes)));
JS
npm run cli -- verify output/token-semantics/evidence.json output/token-semantics/policy.json output/token-semantics/replay
```

For source reproduction, download the three exact `sources[].url` entries in the
manifest as `proxy.json`, `implementation.json`, and `weth.json` into a separate
temporary directory. These are GET requests to Sourcify API v2. Check source content
hashes against `sources[].sourceFiles`; API response hashes identify the records
actually acquired, while later API metadata can change. Install the historical
compilers **outside this repository**:

```bash
npm install --ignore-scripts --no-audit --no-fund solc0612@npm:solc@0.6.12 solc0419@npm:solc@0.4.19
node <<'JS'
const fs = require('node:fs');
const crypto = require('node:crypto');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
for (const [file, packageName] of [['proxy.json','solc0612'], ['implementation.json','solc0612'], ['weth.json','solc0419']]) {
  const record = JSON.parse(fs.readFileSync(file));
  const solc = require(packageName);
  const input = structuredClone(record.stdJsonInput);
  input.settings.outputSelection = {'*': {'*': ['evm.deployedBytecode.object']}};
  const output = JSON.parse((solc.compileStandardWrapper || solc.compile)(JSON.stringify(input)));
  if (output.errors?.some(e => e.severity === 'error')) throw new Error('Compiler error');
  const fqn = record.compilation.fullyQualifiedName;
  const split = fqn.lastIndexOf(':');
  const hex = output.contracts[fqn.slice(0, split)][fqn.slice(split + 1)].evm.deployedBytecode.object;
  const compiled = Buffer.from(hex, 'hex');
  const observed = Buffer.from(record.runtimeBytecode.onchainBytecode.slice(2), 'hex');
  const prefix = b => b.subarray(0, b.length - b.readUInt16BE(b.length - 2) - 2);
  console.log({contract: record.compilation.name, compiler: solc.version(),
    bytes: compiled.length, compiledSha256: sha(compiled), observedSha256: sha(observed),
    fullMatch: compiled.equals(observed), programMatch: prefix(compiled).equals(prefix(observed))});
}
JS
```

Expected: proxy and WETH full matches; implementation full-match false/program-match
true with the exact hashes and 32 metadata-byte differences already documented.
The retained local compilation results also record compiler-file SHA-256 and warning
messages. These old compilers are reproduction dependencies only, not product
dependencies or an endorsement for new deployments.

## Operational stopping conditions and residual risks

Pause, a blacklisted sender/router/pool, insufficient sender balance/allowance, a
balance overflow, inadequate gas or an unmet router minimum can revert the attempt.
Additional token/pool events or unsupported calldata/execution cause unsupported
receipt evidence. Missing, conflicting, stale or noncanonical observations produce
UNKNOWN. Never relax these gates to obtain a favorable result.

The runtime allowlist deliberately stops on any newly observed implementation or
code hash. Future token changes need a fresh bounded source review. Current role
addresses do not authenticate the administrative controllers; no absence of upgrade
risk is claimed. Historical block-end reads do not prove an intra-block execution
boundary or independently reconstruct balance/reserve state. RPC observations and
portable bundle digests are not consensus proofs, and offline replay does not refresh
finality. Recompilation adds source/program evidence but is not a security audit.

Source retrieval failures are preserved separately: Etherscan and some Blockscout
requests returned HTTP 403; legacy Sourcify paths returned 404. Successful API-v2
source records and successful RPC captures are not presented as retries that erase
those failures. No failed public-source request was treated as evidence of absent
contract code or incompatible behavior.

## Readiness matrix and verification

| Feature/gate | Actual test or evidence | Source revision | Remaining risk |
|---|---|---|---|
| Source-program authentication | Independent Solidity compilation; full proxy/WETH match and USDC executable-prefix match | Exact source/compiler hashes in manifest | Compiler and source-service trust; USDC metadata difference; no audit |
| Pinned runtime and legacy proxy binding | Historical/current probes, 20/20 reads each | `e5a26b08aa3a4757087f64aece5d8d21f7bd87ba` | Provider trust, block-end scope, future upgrade |
| Mutable transfer configuration | Both captures unpaused; router/pool unblocked; roles recorded | Same probe revision | Eventual sender and future state not established |
| Genuine supported direct receipt | 19/19 collector reads, 12 state observations; complete supported replay | `3835c5a933c1f3f493ff726dd3b597f68c8c6330` | Retrospective policy and receipt-emitted amounts only |
| Research failure handling | 27 synthetic regressions plus genuine retained-capture offline replay | New research script/tests; final PR CI pins the reviewed revision | Synthetic tests do not establish live behavior |
| Existing product outcomes | Full local suite: 193 tests; demo PASS/VIOLATION/UNKNOWN, exits 0/2/3 | Executable increment `e5a26b0`; final CI linked in PR | Browser gates remain mandatory and are checked on final PR revision |
| Reserve/balance proof | Same historical receipt with reserve requirement gives UNKNOWN/PARTIAL | Unchanged production verifier | No boundary reconstruction or balance proof |
| Controlled execution | Not performed or authorized | Not applicable | Owner wallet, funds, allowance, fresh quote/simulation and policy chronology remain unresolved |

The 28 added tests cover chain/block identity, missing/malformed/code conflicts,
unexpected proxy targets, ABI padding/booleans, administrative restrictions, fixed
RPC request surface, count/size/time limits, error sanitization, extra events, wrong
participants, one-unit amount conflicts beyond `2^53`, incomplete evidence and honest
UNKNOWN. The real offline test checks the retained file hash/digest and confirms that
the reserve check remains UNKNOWN. No tests call a live network.

## One next operational step

**Close the token-compatibility research gate and prepare one concrete owner execution
authorization.** It must identify the public-use Sepolia EOA/recipient, exact input
cap, gas caps, legitimate free test-token/gas acquisition, and any bounded approval.
Once those owner-controlled prerequisites exist, refresh the implementation and
restriction checks, obtain a fresh quote and sender-specific read-only router
simulation, and present the exact final policy/intent record and single direct swap
for authorization before signing/broadcasting. No owner address or numeric execution
budget is invented here. Historical zero minimum is not an execution recommendation.

The optional experiment remains separate from the working historical demonstration
and public deployment. Stop if the refreshed facts fail; retain the existing demo.

## Scope retained

The research concerns one direct zero-native-value Router02 `exactInputSingle`
USDC → WETH operation. Production receipt verification, schemas, existing genuine
evidence, browser and deployment remain unchanged. Receipt compatibility does not
prove immediate post-transaction balances. No reserve-balance PASS is introduced.
No wallet, faucet, approval, signing, broadcast, deployment or final pre-execution
policy is part of this work.
