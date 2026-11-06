# Aftercheck outcome report

- **Evidence class:** RPC_RECEIPT
- **Transaction:** 0x608ca58e7d01dbe0c7fe48af8c0bb9f2bddcf07ccc36f5c28d033bc8d198d5e9
- **Execution:** SUCCEEDED
- **Support:** SUPPORTED
- **Evidence coverage:** PARTIAL
- **Policy verdict:** UNKNOWN

## Checks

- **owner: PASS** — Recorded transaction payer compared with the declared owner
- **recipient: PASS** — Recorded recipient compared with the declared recipient
- **tokenPair: PASS** — Recorded token identities compared with the declared pair
- **maxInputRaw: PASS** — Receipt input amount 1000000000000000000 compared with cap 1000000000000000000 in exact raw units
- **minReceivedRaw: PASS** — Receipt output amount 999496253769344460 compared with minimum 999000000000000000 in exact raw units
- **reserveFloorRaw: UNKNOWN** — Receipt-scoped evidence cannot establish the input-token wallet reserve immediately after the target transaction.

## Receipt observations

- **Chain ID:** 11155111
- **Block:** 0x6526359f4e3c5e1db4d70ecef4510b8f510fd1e05e3dce986a9de32bd7fa7a34 (0x7556c3); transaction index 0x6a
- **Router:** 0x3bfa4769fb09eefc5a80d6e87c3b9c650f7ae48e
- **Factory:** 0x0227628f3f023bb0b980b67d528571c95c6dac1c
- **Pool:** 0x029603931809d430ae47d2f55212cc0e89dbfd52
- **Input token:** 0x0f47e03a0383396635846f8495003fc478b71bca; **logged input:** 1000000000000000000 raw units
- **Output token:** 0x9142fa65aaef921aea2127e88758adee0510a0f0; **logged output:** 999496253769344460 raw units
- **Recipient:** 0x3f82931394a11582e89366fb837e53d5d0baa62a

## Reproduction

- **Evidence SHA-256:** 0x41c8cd52735e76a759e3d93103f4cd6a77d0630f09593e5c9ca0612794880093
- **Policy SHA-256:** 0xddf6ac5f62488a874ab550fa92e95d407df4148b496168d36d40809216a98a9a
- **Mode:** offline replay of trusted RPC observations; finality is not checked.
- **Policy origin:** supplied retrospectively, not authenticated original intent.

## Limitations

- RPC responses are trusted observations, not Ethereum consensus or state proofs. Offline replay does not refresh canonicality or finality.
- Financial checks compare receipt-emitted token amounts under a plain-token assumption. Arbitrary token logs can misrepresent balance changes; nonempty bytecode does not establish token semantics.
- Hash-bound contract metadata and sender code are block-end observations, not proof of immediately-after-transaction wallet balances.
- Pool price and tick fields are ABI- and range-checked only. The AMM price transition, liquidity accounting and execution quality are not independently simulated.
- The supplied policy is retrospective; its original pre-transaction intent is not authenticated.
- Receipt-scoped evidence cannot establish the input-token wallet reserve immediately after the target transaction.

**Not a production security audit, financial recommendation, or permission to move funds.**
