# Ordinary HTTP/RPC rehearsal

**RPC_REHEARSAL — not an official CRE CLI simulation.**

- Source revision: f7e4048389d3acf85d7c16020b34990c03fde93f
- Comparison: MATCH
- Scenario: REFERENCE
- Public manifest: https://raw.githubusercontent.com/denchik37/aftercheck/2b86229b8db8e4cf2217de73aa4ab4d9ef9f8a4d/integrations/cre/public/reference.json
- Manifest HTTP status: 200
- Manifest fetch: VERIFIED
- Actual RPC chain ID: 11155111
- Configured chain selector: 16015286601757825753
- Requested historical block: 7689923
- Returned header hash: 0x6526359f4e3c5e1db4d70ecef4510b8f510fd1e05e3dce986a9de32bd7fa7a34
- Expected pool: 0x029603931809d430ae47d2f55212cc0e89dbfd52
- Observed pool: 0x029603931809d430ae47d2f55212cc0e89dbfd52
- Financial-policy verdict: unchanged; this command does not evaluate or modify it.
- Read-only RPC requests: 3
- Reason codes: POOL_IDENTITY_MATCH

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
    "result": {
      "number": "0x7556c3",
      "hash": "0x6526359f4e3c5e1db4d70ecef4510b8f510fd1e05e3dce986a9de32bd7fa7a34"
    },
    "errorCode": null
  },
  {
    "method": "eth_call",
    "params": [
      {
        "to": "0x0227628f3f023bb0b980b67d528571c95c6dac1c",
        "data": "0x1698ee820000000000000000000000000f47e03a0383396635846f8495003fc478b71bca0000000000000000000000009142fa65aaef921aea2127e88758adee0510a0f000000000000000000000000000000000000000000000000000000000000001f4"
      },
      "0x7556c3"
    ],
    "result": "0x000000000000000000000000029603931809d430ae47d2f55212cc0e89dbfd52",
    "errorCode": null
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
