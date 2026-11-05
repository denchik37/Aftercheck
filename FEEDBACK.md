# Uniswap developer feedback

Prepared 5 November 2026 from Aftercheck's implementation work. This file does not indicate that the Developer Feedback Form has been submitted.

## Integration

Aftercheck implements read-only inspection of an existing Ethereum Sepolia transaction that directly calls Uniswap v3 SwapRouter02 `exactInputSingle`. The adapter decodes calldata, checks the official router and factory, binds the selected pool through historical RPC observations, and reconciles its Swap event with the two ERC-20 Transfer events. It compares those receipt-emitted amounts with a separately supplied retrospective policy.

Relevant implementation: [`src/uniswap.ts`](src/uniswap.ts) (`decodeExactInputSingle`, `protocolStateRequests`, `poolStateRequests`, `evaluateReceiptBundle`), [`src/collect.ts`](src/collect.ts), and [`docs/PROTOCOL.md`](docs/PROTOCOL.md). The repository's tests include malformed calldata, wrong deployments, inconsistent pool metadata, unavailable historical state, transfer mismatches and exact arithmetic.

No new transaction was signed for this implementation. The [retained historical example](examples/sepolia/README.md) is a third-party swap from February 2025, captured read-only in November 2026 with independent literal receipt expectations.

## What helped

The [official deployment table](https://developers.uniswap.org/docs/protocols/v3/deployments/v3-ethereum-deployments) separates Ethereum mainnet and Sepolia addresses and explicitly cautions against assuming identical deployments. The [Router02 interface](https://github.com/Uniswap/swap-router-contracts/blob/main/contracts/interfaces/IV3SwapRouter.sol) and [pool implementation](https://github.com/Uniswap/v3-core/blob/main/contracts/UniswapV3Pool.sol) made the precise call shape and output-transfer/payment-callback/Swap-event order inspectable.

## Friction and concrete suggestions

- **Router versions:** Router02 uses a seven-field `exactInputSingle` tuple; the older router's deadline-bearing ABI has eight fields. A prominent side-by-side ABI and selector example would help readers following older swap tutorials.
- **Factory getter:** The implemented Router02 exposes the inherited `factory()` getter. An explicit deployed-contract read example would reduce confusion with constructor parameters such as `_factoryV3`.
- **Historical evidence:** Deployment documentation identifies contracts, but reproducible transaction inspection also needs a provider that accepts EIP-1898 block-hash state parameters. A small public example showing `getPool`, pool metadata and the exact historical block context would be useful. An unavailable historical call must remain unknown; a latest-state read is a different observation.
- **Receipt scope:** A reference fixture containing calldata, raw Transfer/Swap logs and their exact signed amounts would help integrations distinguish observed event amounts from proof of wallet balances. Aftercheck deliberately does not infer reserves or arbitrary token semantics from those logs.

These are implementation observations and suggestions, not survey ratings, measured onboarding times or a claim of an independent security audit.

## Observed historical capture

Publicnode returned missing receipts in some attempts and a receipt with unavailable historical state in another. Its retained incomplete bundle independently replays as UNKNOWN. dRPC failed the initial chain-ID request, so that attempt produced no evidence bundle or policy verdict. A subsequent [keyless Tenderly capture](https://github.com/denchik37/aftercheck/actions/runs/42068312090) returned the receipt and all twelve required hash-bound observations in nineteen read-only calls. The [retained Publicnode partial bundle](examples/sepolia/evidence-publicnode-partial.json) keeps that incomplete result reproducible. Sanitized errors do not establish whether an individual failure was caused by history retention, parameter support or another provider condition.

## Form handoff

The [Mumbai Uniswap challenge](https://ethglobal.com/events/mumbai/prizes/uniswap-foundation) requires the [Developer Feedback Form](https://developers.uniswap.org/hackathon-feedback) and this file's URL. The project owner must submit the form with:

<https://github.com/denchik37/aftercheck/blob/main/FEEDBACK.md>

Form completion and sponsor qualification remain unconfirmed.
