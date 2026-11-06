# Ordinary HTTP/RPC rehearsal

**RPC_REHEARSAL — not an official CRE CLI simulation.**

- Source revision: f7e4048389d3acf85d7c16020b34990c03fde93f
- Comparison: UNAVAILABLE
- Scenario: REFERENCE
- Public manifest: https://raw.githubusercontent.com/denchik37/aftercheck/2b86229b8db8e4cf2217de73aa4ab4d9ef9f8a4d/integrations/cre/public/unavailable.json
- Manifest HTTP status: 404
- Manifest fetch: UNAVAILABLE
- Actual RPC chain ID: UNAVAILABLE
- Configured chain selector: 16015286601757825753
- Requested historical block: UNAVAILABLE
- Returned header hash: UNAVAILABLE
- Expected pool: 0x029603931809d430ae47d2f55212cc0e89dbfd52
- Observed pool: UNAVAILABLE
- Financial-policy verdict: unchanged; this command does not evaluate or modify it.
- Read-only RPC requests: 0
- Reason codes: PUBLIC_MANIFEST_UNAVAILABLE, HTTP_STATUS_ERROR, CHAIN_ID_UNAVAILABLE, CHAIN_SELECTOR_UNAVAILABLE, REQUESTED_BLOCK_UNAVAILABLE, HEADER_UNAVAILABLE, CALL_IDENTITY_UNAVAILABLE, POOL_RESULT_UNAVAILABLE

## Requests and bounded observations

```json
[]
```

## Limits

- Only Uniswap factory pool identity is compared; the financial-policy verdict is unchanged.
- The EVM call is bound to a block number; its separately observed header is not block-hash binding for that call.
- Chain ID is selected through the configured network/chain selector; no consensus authentication.
- An artifact digest establishes integrity, not source authenticity or Ethereum consensus.
- RPC observations are trusted provider responses, not transaction-boundary balance or reserve proofs.
- This observation uses the same Tenderly provider as the retained capture; independent-source validation is not established.
- RPC_REHEARSAL uses ordinary HTTP/RPC code; this result is not CRE CLI simulation evidence.
