# Ordinary HTTP/RPC rehearsal

**RPC_REHEARSAL — not an official CRE CLI simulation.**

- Source revision: ec92456bc401d2c30eff44900ceb634c0d0c7310
- Comparison: UNAVAILABLE
- Scenario: INTENTIONAL_MISMATCH
- Public manifest: https://raw.githubusercontent.com/denchik37/aftercheck/2b86229b8db8e4cf2217de73aa4ab4d9ef9f8a4d/integrations/cre/public/intentional-mismatch.json
- Manifest HTTP status: 200
- Manifest fetch: VERIFIED
- Actual RPC chain ID: 11155111
- Configured chain selector: 16015286601757825753
- Requested historical block: 7689923
- Returned header hash: UNAVAILABLE
- Expected pool: 0x0000000000000000000000000000000000000001
- Observed pool: UNAVAILABLE
- Financial-policy verdict: unchanged; this command does not evaluate or modify it.
- Read-only RPC requests: 2
- Reason codes: HEADER_UNAVAILABLE, CALL_IDENTITY_UNAVAILABLE, POOL_RESULT_UNAVAILABLE

## Requests and bounded observations

```json
[
  {
    "method": "eth_chainId",
    "params": [],
    "result": "0xaa36a7",
    "errorCode": null
  },
  {
    "method": "eth_getBlockByNumber",
    "params": [
      "0x7556c3",
      false
    ],
    "result": null,
    "errorCode": "RPC_TIMEOUT"
  }
]
```

## Limits

- Only Uniswap factory pool identity is compared; the financial-policy verdict is unchanged.
- The EVM call is bound to a block number; its separately observed header is not block-hash binding for that call.
- Chain ID is selected through the configured network/chain selector; no consensus authentication.
- An artifact digest establishes integrity, not source authenticity or Ethereum consensus.
- RPC observations are trusted provider responses, not transaction-boundary balance or reserve proofs.
- This observation uses the same Tenderly provider as the retained capture; independent-source validation is not established.
- RPC_REHEARSAL uses ordinary HTTP/RPC code; this result is not CRE CLI simulation evidence.
