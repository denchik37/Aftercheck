# Historical Sepolia swap: genuine RPC capture

This example replays an existing third-party Sepolia transaction from **12 February 2025, 03:02:00 UTC**. Aftercheck collected its public RPC observations on **5 November 2026**. No transaction was signed, simulated into existence or submitted by this project. The tokens are testnet contracts; the policies below were supplied retrospectively for demonstration and do not establish the original trader's intent.

## Source and exact artifact

[`evidence.json`](evidence.json) is an unchanged copy of `evidence-case1-tenderly.json` from the capture artifact. It contains the collector's allowlisted transaction, receipt and block fields, raw historical code/call results, collection metadata and digest. No missing fields were filled from an explorer or another provider.

| Provenance | Value |
|---|---|
| Public transaction | [`0x608ca58e…198d5e9`](https://sepolia.etherscan.io/tx/0x608ca58e7d01dbe0c7fe48af8c0bb9f2bddcf07ccc36f5c28d033bc8d198d5e9) |
| Chain | Ethereum Sepolia, `11155111` |
| Block / transaction index | `7689923` / `106` |
| Block hash | `0x6526359f4e3c5e1db4d70ecef4510b8f510fd1e05e3dce986a9de32bd7fa7a34` |
| Capture source revision | [`14b9ca2d9934146300046656d283d88c788a5bc6`](https://github.com/denchik37/aftercheck/commit/14b9ca2d9934146300046656d283d88c788a5bc6) |
| GitHub Actions run | [42068312090](https://github.com/denchik37/aftercheck/actions/runs/42068312090), job `127388785758` |
| Provider | Keyless `https://sepolia.gateway.tenderly.co`; [official public endpoint documentation](https://docs.tenderly.co/node-rpc/overview#public-endpoint-limits) |
| Acquisition timestamp | `2026-11-05T16:49:14.801Z` |
| Calls / historical observations | `19` read-only calls / `12` state observations, zero unavailable state reads |
| Evidence digest | `0x41c8cd52735e76a759e3d93103f4cd6a77d0630f09593e5c9ca0612794880093` |
| Evidence file SHA-256 | `d57013b097c323271d25a021f6244e79a00ec72853dd6aed0828f2a481fe0c36` (`183990` bytes) |
| Downloaded artifact | `13434988137`, `sepolia-evidence-42068312090-1` |
| Artifact ZIP SHA-256 | `e0cf11cd4087f618433fb4bbaf99305ea983e397ab78fb184585a6c155658d64` |

Each historical `eth_call` and `eth_getCode` uses `{blockHash, requireCanonical: true}` for the block above. These are **block-end observations**, not proof of immediately-after-transaction balances. The collector rechecks chain identity and the block's canonical hash after state collection. Offline replay cannot refresh those observations or establish finality. GitHub artifacts have a retention period; the selected evidence is preserved in this repository.

## Independent expected observations

The expected values were transcribed from the public explorer's calldata and raw receipt logs before the successful RPC capture, then checked against that capture. [`test/real-case.test.mjs`](../../test/real-case.test.mjs) uses literal expectations rather than generating its expected amounts from the evaluator.

| Item | Expected observation |
|---|---|
| Router | `0x3bfa4769fb09eefc5a80d6e87c3b9c650f7ae48e` |
| Factory | `0x0227628f3f023bb0b980b67d528571c95c6dac1c` |
| Pool / fee | `0x029603931809d430ae47d2f55212cc0e89dbfd52` / `500` |
| Owner and recipient | `0x3f82931394a11582e89366fb837e53d5d0baa62a` |
| Input token | TIGER, `0x0f47e03a0383396635846f8495003fc478b71bca` |
| Output token | Lab USD (LUSD), `0x9142fa65aaef921aea2127e88758adee0510a0f0` |
| Input amount | `1000000000000000000` raw units |
| Output amount | `999496253769344460` raw units |
| Calldata | Direct seven-field Router02 `exactInputSingle`, selector `0x04e45aaf`; minimum `0`, price limit `0`, native value `0` |
| Receipt order | Output Transfer at index `111`, input Transfer at `112`, pool Swap at `113`; no other logs |

The official deployment mapping and interface are linked in [`docs/PROTOCOL.md`](../../docs/PROTOCOL.md). Captured nonempty bytecode does not prove arbitrary token semantics. The checks compare **receipt-emitted amounts under a plain-token assumption**; they do not establish full balance effects, token security, liquidity accounting or AMM price correctness.

## Reproduce the three policy outcomes offline

From the repository root, after installing the locked dependencies:

```bash
npm run cli -- verify examples/sepolia/evidence.json examples/sepolia/policy-pass.json output/sepolia-pass
npm run cli -- verify examples/sepolia/evidence.json examples/sepolia/policy-violation.json output/sepolia-violation
npm run cli -- verify examples/sepolia/evidence.json examples/sepolia/policy-reserve.json output/sepolia-reserve
```

| Policy | Rule | Expected verdict / exit code |
|---|---|---|
| [`policy-pass.json`](policy-pass.json) | Input cap `1000000000000000000`; output minimum `999000000000000000` | `PASS` / `0` |
| [`policy-violation.json`](policy-violation.json) | Input cap lowered to `900000000000000000` | `VIOLATION` / `2` |
| [`policy-reserve.json`](policy-reserve.json) | Base policy plus input-token reserve floor `1` | `UNKNOWN` / `3` |

Execution is `SUCCEEDED` and the route is `SUPPORTED` in all three. Reserve coverage is `PARTIAL`: receipt evidence cannot establish the owner's input-token reserve immediately after this transaction. A retrospective policy violation does not claim that the original trader violated their own intent. The CLI writes the unchanged evidence content, supplied policy and JSON/Markdown reports. The tests repeat all three commands with common network entry points disabled.

## Retained real provider failures

[`evidence-publicnode-partial.json`](evidence-publicnode-partial.json) preserves the independent Publicnode result from [run 42067676503](https://github.com/denchik37/aftercheck/actions/runs/42067676503), source revision [`b8181d96ea502fe05f2f938cf05815feaa0b1bc4`](https://github.com/denchik37/aftercheck/commit/b8181d96ea502fe05f2f938cf05815feaa0b1bc4). Its receipt matched the same three events, but all seven initial historical state requests returned sanitized `RPC_REMOTE_ERROR`. The underlying cause was not retained; this does not identify a particular provider defect. Replay gives `SUCCEEDED / UNSUPPORTED / PARTIAL / UNKNOWN`.

Its evidence digest is `0xeb791a7eedbdb9362943d9f939ac9649c29f4d490e08ec1bfdd067c4b78a8e8f`; file SHA-256 is `d562b472f1bdd1eb1cfe34f6d41381a85d771a297f69f75555cde349f98ed617`. The downloaded run artifact had SHA-256 `f8538829eb925227a6480f88e8bd0707a574959d7add9f660dbce88de538859d`.

The earlier [run 42066113089](https://github.com/denchik37/aftercheck/actions/runs/42066113089) returned a missing receipt from Publicnode. In run 42067676503, dRPC failed the initial chain-ID request with `RPC_HTTP_ERROR`. In the successful Tenderly run, both Publicnode attempts again returned missing receipts; both Tenderly captures completed, but only the independently checked February 2025 case is used here. Every attempt was separate. A successful workflow exit did not turn any partial attempt into a policy PASS.

All reported chain observations remain dependent on their supplying RPC provider. Digests detect later changes; they are not consensus proofs, source authentication, an audit or protection for real funds.
