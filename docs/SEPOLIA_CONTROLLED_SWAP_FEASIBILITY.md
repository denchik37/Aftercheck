# Controlled Sepolia swap with a predeclared policy

**Issue [#18](https://github.com/denchik37/aftercheck/issues/18) · 6 November 2026 IST**

## Decision and objective

**CONDITIONAL GO for one existing Circle test-USDC → WETH pool; execution is not ready or authorized.** The proposed experiment is a direct Sepolia Router02 swap that can succeed under its encoded minimum while violating a stricter operator minimum published beforehand. Any future result must be reported as observed, including PASS, UNKNOWN, unsupported execution, or revert. This is an intentionally constructed parameter-mismatch demonstration, not evidence of a real financial loss or a Uniswap defect.

The historical TIGER/Lab USD pool still returns a positive quote, but legitimate input-token acquisition and current token semantics are unverified. Do not spend more time searching for those tokens. One bounded alternative has a documented free input-token faucet, an existing factory-selected pool, positive liquidity, and a successful read-only quote. No new contracts, liquidity position, paid provider, backend, or verifier scope expansion is needed for that candidate.

This investigation does not authorize wallet creation on the owner's behalf, funding, token approvals, signing, broadcasting, deployment, or publication of a final policy containing an owner wallet identity. None has been performed. No final pre-execution policy or controlled transaction exists.

## Evidence vocabulary

| Label | Meaning in this report |
|---|---|
| VERIFIED | Checked source, repository behavior, or executed test; scope is stated |
| OBSERVED BUT PROVIDER-DEPENDENT | Live RPC response at a recorded block; not a consensus/state proof |
| INFERRED | Reasoned implication with its assumptions stated |
| UNVERIFIED | Not established by retained evidence |
| BLOCKED | A necessary prerequisite currently prevents readiness |
| NOT APPLICABLE | Outside this bounded experiment |

## Actual implementation boundary

Inspection started with both `main` and `spike/predeclared-sepolia-example` at `09bfe5d0352276267476d5050bc996a3d0f09513`. Issue #18 had no comments and there were no open PRs at the initial check. Existing [branch CI run 42097844215](https://github.com/denchik37/aftercheck/actions/runs/42097844215) was successful: its inspected test/browser logs recorded **117 Node tests**, all three offline demo outcomes, and **28 browser checks**. These are baseline results, not validation of this spike.

The actual source, including `src/uniswap.ts`, `evidence.ts`, `collect.ts`, `inspect.ts`, `verify.ts`, `policy.ts`, `rpc.ts`, `values.ts`, the CLI, protocol/readiness docs, historical example, regression tests, and both relevant workflows, controls this assessment. `docs/READINESS.md` contains older pinned checkpoints; its older counts are not the current baseline.

The supported call is `exactInputSingle((address,address,uint24,address,uint256,uint256,uint160))`, selector `0x04e45aaf`. Its seven fields are tokenIn, tokenOut, fee, recipient, amountIn, amountOutMinimum, and sqrtPriceLimitX96. There is **no deadline field**. The profile requires direct Router02 targeting, zero native value, a supported EOA sender without observed contract/delegated code, distinct coded token contracts, positive full exact input below `2^255`, and zero square-root price limit. Universal Router, multicall, multihop, recipient aliases, router-balance input mode, partial-fill routes, and type-4/delegated execution remain unsupported.

The entire receipt must reconcile one output Transfer (pool → recipient), one input Transfer (sender → pool), then one pool Swap, with exact signed amounts, participants, canonical ABI widths, identities and ordering. At most one ordinary input-token Approval for sender/router may occur inside the payment callback. Extra transfers, swaps, unrelated events, inconsistent fields or missing observations cannot become PASS. Token events do not prove actual balance semantics. Reserve reconstruction is outside scope and remains UNKNOWN.

The collector needs transaction, receipt, containing block, chain/canonicality checks and **12 state observations**: sender/router/factory/two token code reads; router `factory()`; factory `getPool()`; pool code plus `factory()`, `token0()`, `token1()`, `fee()`. Every state read must use `{blockHash, requireCanonical:true}`. Current feasibility reads are not substituted into historical verifier evidence.

## A. Deployment and interfaces

| Identity | Value | Basis |
|---|---|---|
| Network / chain | Ethereum Sepolia / `11155111` | Official documentation and live chain ID |
| Router02 | `0x3bfa4769fb09eefc5a80d6e87c3b9c650f7ae48e` | Official Uniswap deployment; observed nonempty code and matching `factory()` |
| Factory | `0x0227628f3f023bb0b980b67d528571c95c6dac1c` | Official deployment and observed code/pool binding |
| QuoterV2 | `0xed1f6473345f45b75f8179591dd5ba1888cf2fb3` | Official deployment; observed code and matching `factory()` |
| Circle test USDC | `0x1c7d4b196cb0c7b01d743fbc6116a902379c7238` | Circle's official Sepolia deployment |
| Sepolia WETH | `0xfff9976782d46cc05630d1f6ebab18b2324d6b14` | Uniswap's official wrapped-native table |

[Uniswap's deployment table](https://developers.uniswap.org/docs/protocols/v3/deployments/v3-ethereum-deployments) and the official [Router02 interface](https://github.com/Uniswap/swap-router-contracts/blob/main/contracts/interfaces/IV3SwapRouter.sol) were checked on 6 November IST. Documentation recommends Universal Router for general integrations, but explicitly lists this Router02 deployment. This spike preserves the narrower supported interface.

The [QuoterV2 interface](https://github.com/Uniswap/v3-periphery/blob/main/contracts/interfaces/IQuoterV2.sol) differs: its tuple is tokenIn, tokenOut, **amountIn, fee**, sqrtPriceLimitX96. `eth_call` quoting returns output, square-root price after the simulated swap, initialized ticks crossed, and a swap-path gas estimate. It does not pay from a real EOA or exercise that EOA's allowance. Its gas estimate is not the complete approval-plus-router transaction budget.

Nonempty runtime code and matching metadata are provider observations, not a reproduced source-to-bytecode proof or a token audit.

## B. Bounded candidate investigation

Both candidates below were observed through the single public keyless provider `https://sepolia.gateway.tenderly.co`. Complete probe attempts pinned block **12071805** (`0xb8337d`), hash `0xa66ccae4fd8140aeab9d014a1bbd3012e8a38f3a73fd6b6b4e88dc34f02525b1`, timestamp **2026-11-05T20:20:12Z**, and passed their final block/chain rechecks. These quotes are observations at that block, not promises about later output.

| Item | Historical candidate | Selected bounded alternative |
|---|---|---|
| Pool | `0x029603931809d430ae47d2f55212cc0e89dbfd52` | `0x3289680dd4d6c10bb19b899729cda5eef58aeff1` |
| Token0 / input | TIGER `0x0f47e03a0383396635846f8495003fc478b71bca` | Circle test USDC `0x1c7d4b196cb0c7b01d743fbc6116a902379c7238` |
| Token1 / output | Lab USD `0x9142fa65aaef921aea2127e88758adee0510a0f0` | WETH `0xfff9976782d46cc05630d1f6ebab18b2324d6b14` |
| Fee | `500` (0.05%) | `500` (0.05%) |
| Observed active liquidity | `800005769246931921502066` | `16015164533241097` |
| Tick | `99055` | `174526` |
| Square-root price X96 | `11213084133036597495817993051651` | `488066059377187592329714233123365` |
| Proposed input, raw | `1000000000000000000` | `1000000` |
| Quoted output, raw | `20016908621170349224705` | `37929811014366` |
| Quote swap-gas component | `102821` | `95430` |
| Acquisition | BLOCKED: no authenticated faucet/distribution found | Documented public Circle faucet; owner receipt UNVERIFIED |

For each full probe the official factory selected exactly the nominated pool; pool factory/token order/fee matched; router/factory/pool/token/quoter code was nonempty; `slot0` was unlocked. The positive quotes support a small-trade hypothesis more directly than the liquidity field alone. They do not establish future inclusion, an actual supported receipt, full-fill behavior of a future owner call, or ordinary token balance semantics.

Only one fallback token pair was investigated. Discovery queried fee tiers `500` and `3000`; the latter returned `0x6ce0896eae6d4bd668fde41bb784548fb8f59b50`, but was not developed as another candidate after the `500` pool quoted successfully. No further pool search is justified.

An earlier sequential research attempt at block `12071790` returned metadata and a quote but timed out on an optional token-balance read, exhausting the request time budget before canonicality/chain rechecks. It is an **incomplete attempt**, not silently repaired using another capture. Bounded parallel reads subsequently completed independent captures.

## C. Historical evidence availability

The unchanged production `inspect` command was run afresh against the retained third-party transaction `0x608ca58e7d01dbe0c7fe48af8c0bb9f2bddcf07ccc36f5c28d033bc8d198d5e9`. Capture began **2026-11-05T20:19:22.233Z** and returned **SUCCEEDED / SUPPORTED / COMPLETE / PASS** under the existing retrospective pass policy, with all **12 historical state observations** and no collection errors.

The fresh evidence digest was `0xd170ac971902427d8939803ddd596837a9be5d44e4671727db354164db631441`. Its entire normalized payload matched the retained original apart from capture timestamp and digest. It still describes the February 2025 transaction at block `7689923`, hash `0x6526359f4e3c5e1db4d70ecef4510b8f510fd1e05e3dce986a9de32bd7fa7a34`; it is not a new transaction.

This establishes a working collector path on the same provider at the observation time, not a service guarantee. [Tenderly documents its keyless Sepolia endpoint](https://docs.tenderly.co/node-rpc/rpc-reference) and [public limits](https://docs.tenderly.co/node-rpc/overview); the live test, rather than ordinary method availability, established this historical [EIP-1898](https://eips.ethereum.org/EIPS/eip-1898) capability. No observations from another provider were merged into an evidence bundle.

## Completion checkpoint

Deployment, concrete pool observations, and the historical collector path are established to the limits above. Token/gas prerequisites, the separate chronology procedure, the bounded probe's regression evidence, and final reproducibility/CI references will be completed in the following focused increments. This checkpoint does not authorize execution or claim final spike CI has run.
