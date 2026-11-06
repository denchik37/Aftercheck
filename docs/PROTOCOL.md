# Supported receipt profile

Aftercheck compares **amounts emitted in a transaction receipt** with a supplied retrospective policy. It independently checks the narrow Uniswap route and the consistency of its recorded evidence. It does not prove wallet balances, token semantics, Ethereum consensus, or the user's original intent.

The implementation is in [`src/uniswap.ts`](../src/uniswap.ts). Its adversarial regression fixtures are explicitly synthetic, including their invented block identities and placeholder bytecode; they are not public-chain evidence. Tests are in [`test/uniswap.test.mjs`](../test/uniswap.test.mjs).

## Deployment and call

The [official Ethereum deployment table](https://developers.uniswap.org/docs/protocols/v3/deployments/v3-ethereum-deployments), checked on 5 November 2026, lists these distinct Sepolia contracts:

| Identity | Pinned value |
|---|---|
| Network | Ethereum Sepolia, chain ID `11155111` |
| SwapRouter02 | `0x3bfa4769fb09eefc5a80d6e87c3b9c650f7ae48e` |
| Uniswap v3 factory | `0x0227628f3f023bb0b980b67d528571c95c6dac1c` |
| Supported function | `exactInputSingle((address,address,uint24,address,uint256,uint256,uint160))` |
| Function selector | `0x04e45aaf` |

The [Router02 interface](https://github.com/Uniswap/swap-router-contracts/blob/70bc2e40dfca294c1cea9bf67a4036732ee54303/contracts/interfaces/IV3SwapRouter.sol) has seven tuple fields, in this order: input token, output token, fee, recipient, input amount, minimum output, and square-root price limit. The older router's deadline-bearing eight-field ABI is a different interface and is rejected.

The admitted transaction directly targets the pinned router, sends zero native value, specifies positive full input below `2^255`, and uses zero price limit. The profile rejects multicalls, other routers, aggregators, multihop routes, recipient aliases, router-balance input mode, partial fills, type-4 authorization transactions, and senders with observed contract or delegated code. The input and output tokens must be distinct, nonzero addresses with observed code. Fee fields must be canonical `uint24` values and agree with the actual factory-selected pool.

Uniswap's current deployment documentation recommends Universal Router for general integrations. Aftercheck deliberately supports this smaller historical Router02 interface; it does not claim that Router02 is the latest recommended integration.

## Identity and state observations

The transaction, receipt, containing block, and each log must agree on their hashes, block numbers, and transaction index. The target must occur at that exact index in the captured block's transaction list. Log indices must be unique and increasing; removed logs are rejected. A final canonical-block recheck must agree with the captured block.

State requests use [EIP-1898](https://eips.ethereum.org/EIPS/eip-1898) with `{ "blockHash": "…", "requireCanonical": true }`. Offline evaluation checks the recorded method, target, calldata, block context, and result for every required read. Missing historical state, an RPC error, number-only context, or a `latest` context cannot establish support. These checks bind the observations to one claimed block; they do not authenticate the provider's answers.

There are two bounded groups of observations:

| Group | Required observations |
|---|---|
| Transaction and route | Sender code; router, factory, and both token contracts' code; router `factory()`; factory `getPool(token0, token1, fee)` |
| Factory-selected pool | Pool code, `factory()`, `token0()`, `token1()`, and `fee()` |

The v3 router's inherited accessor is **`factory()`**, not `factoryV3()`. The factory result supplies the pool address; pool metadata is separately checked against the sorted token pair and fee. No pool address supplied only by the policy or by a log is accepted as sufficient binding.

Code and metadata reads are observations at the end of the block. Empty sender code is a bounded profile check, not proof of that account's code state at every transaction boundary. Nonempty token bytecode is not verification that a token has ordinary balance semantics. No code hash or replay digest is described as a consensus proof.

## Event reconciliation

The [v3 pool event interface](https://github.com/Uniswap/v3-core/blob/5ea68a77cb541c6b3812df783be71ba8c081e25f/contracts/interfaces/pool/IUniswapV3PoolEvents.sol) defines signed `amount0` and `amount1` from the pool's perspective. A supported input is positive, and its output is negative. The adapter checks both token directions, exact ABI widths and padding, signed tick extension, and [v3 price/tick bounds](https://github.com/Uniswap/v3-core/blob/5ea68a77cb541c6b3812df783be71ba8c081e25f/contracts/libraries/TickMath.sol).

Price and tick fields receive ABI and individual range checks only. Their mutual consistency, the AMM's price transition and liquidity accounting are not reconstructed. Financial checks use the reconciled emitted token quantities; this profile is not an independent execution simulation or an execution-quality assessment.

The whole supported receipt contains one pool `Swap` and two [ERC-20 `Transfer`](https://eips.ethereum.org/EIPS/eip-20) events:

1. Output token: selected pool → declared calldata recipient.
2. Input token: transaction sender → selected pool.
3. Pool `Swap`: router as indexed sender, calldata recipient as indexed recipient.

This order follows the [pool implementation](https://github.com/Uniswap/v3-core/blob/5ea68a77cb541c6b3812df783be71ba8c081e25f/contracts/UniswapV3Pool.sol): output transfer, payment callback, then `Swap`. The exact transfer amounts must match the signed pool amounts, input must equal the calldata's full input, and output must meet the router's minimum. A separately supplied policy may demand a stricter minimum or cap.

One ordinary input-token `Approval` event for the transaction sender and router is allowed during the payment callback, after the output transfer and before `Swap`; it is not counted as a transfer. It may appear before or after the input transfer. Extra transfers, extra swaps, unrelated events, contradictory participants, malformed encoding, and inconsistent amounts cannot receive PASS.

**Token assumption:** two internally consistent events do not prove actual balance changes for arbitrary ERC-20 implementations. Fee-on-transfer, rebasing, proxy upgrades, malicious event emission, and hidden token accounting are not established by this profile. The report's financial checks are explicitly limited to receipt-emitted amounts under the plain-token assumption. Do not present this as general token-balance verification.

## Verdicts and limitations

- Execution, route support, evidence coverage, and policy verdict remain separate fields.
- Coherent receipt amounts can produce PASS or VIOLATION for owner, recipient, token pair, maximum input, and minimum emitted output.
- Shared identity conflicts produce UNKNOWN with CONFLICTED evidence. Missing required observations produce UNKNOWN with PARTIAL evidence.
- A required reserve floor is always UNKNOWN. A supported amount-policy violation remains visible alongside that unknown check.
- `SYNTHETIC_RPC_FIXTURE` evidence can only receive `SUPPORTED_TEST_PROFILE`; it never becomes a genuine chain observation.
- `RPC_RECEIPT` identifies the asserted collection source. A portable bundle can be fabricated together with its digest. Replay verifies its internal consistency under RPC trust; it does not prove source authenticity or refresh chain finality.

No parent/end-block balance subtraction, wallet signing, token approvals, transaction submission, tracing, or transaction-boundary reserve reconstruction is performed by this adapter.

## Independent test expectations

Tests use literal public ABI selectors and event topics, manually constructed two's-complement values, both token directions, exact decimal thresholds beyond JavaScript's safe-integer range, and individually corrupted identities. The tests cover the implemented evidence boundary; a passing fixture suite is not evidence that a real swap occurred or that the application has been audited.

The separate [historical Sepolia example](../examples/sepolia/README.md) retains an unchanged genuine RPC capture and a separate incomplete provider attempt. Its [real-case tests](../test/real-case.test.mjs) compare literal transaction identities, calldata, raw logs and quantities independently recorded from the explorer before the successful capture, then exercise the three offline CLI outcomes. These checks add real captured observations to the synthetic regression suite; they retain the same RPC trust and receipt-scoped claim boundary described above.

## Optional CRE corroboration boundary

The [optional integration](CRE_INTEGRATION.md) supplements this adapter with one
historical factory `getPool` comparison. Its public manifest is derived from the
retained genuine evidence, pinned to exact transaction, chain, block, factory,
token, fee and source identities. A successful external manifest fetch is a
required input; a locally configured fallback identifies the target on failure
and cannot substitute for fetched evidence.

The official SDK workflow requests a block-number-bound contract read and a
separate numbered-block header. This differs from the original capture's
EIP-1898 hash-bound observations. Neither a matching separate header nor an
artifact digest turns the new call into a consensus proof or transaction-boundary
state reconstruction. The fixed Tenderly endpoint is the original capture's
provider, so provider independence is not established.

`aftercheck.cre-corroboration.v1` separates `MATCH`, `MISMATCH`, `UNAVAILABLE` and
`UNSUPPORTED` from the core report dimensions. Its execution metadata separates
`CRE_CLI_SIMULATION`, `RPC_REHEARSAL` and `UNIT_TEST`. The digest-bound consumer
recomputes comparisons, checks the source call/evidence and renders a separate
`aftercheck.cre-appendix.v1`. Local result files remain self-reported; metadata
alone does not authenticate execution. The financial-policy report is unchanged,
including reserve UNKNOWN and any established amount-policy VIOLATION.

The [shared comparator](../integrations/cre/shared.ts),
[configuration boundary](../integrations/cre/config.ts),
[official workflow](../integrations/cre/workflow/main.ts) and
[consumer](../src/corroboration.ts) are the implemented scope. The
[execution matrix](evidence/cre/README.md) distinguishes actual HTTP/RPC runs and
WASM compilation from the still authentication-blocked official simulation.
No token balance, reserve, price feed, CCIP operation, signing or broadcast is
added to the supported profile.
