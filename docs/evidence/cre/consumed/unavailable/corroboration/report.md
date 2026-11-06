# External corroboration — Chainlink CRE

- **Pool identity comparison:** UNAVAILABLE
- **Execution classification:** RPC_REHEARSAL
- **Scenario:** REFERENCE
- **Manifest HTTP fetch:** UNAVAILABLE
- **Result authenticity:** self-reported local file; not an authenticated Chainlink or DON attestation.

## Original Aftercheck result

- **Transaction execution:** SUCCEEDED
- **Protocol support:** SUPPORTED
- **Evidence coverage:** COMPLETE
- **Financial-policy verdict:** PASS (unchanged)
- **Core report SHA-256:** 0x3a1d35084aabd0aaf524bb5a136bcf3eac818300b87b711168ec3459e0bcd326

## Source and comparison

- **Transaction:** 0x608ca58e7d01dbe0c7fe48af8c0bb9f2bddcf07ccc36f5c28d033bc8d198d5e9
- **Chain ID:** 11155111
- **Historical block:** 7689923
- **Retained block hash:** 0x6526359f4e3c5e1db4d70ecef4510b8f510fd1e05e3dce986a9de32bd7fa7a34
- **CRE requested block:** UNAVAILABLE
- **CRE returned header hash:** UNAVAILABLE
- **Read binding:** block-number request with a separate header comparison; not a hash-bound eth_call.
- **Factory:** 0x0227628f3f023bb0b980b67d528571c95c6dac1c
- **Method:** getPool(address,address,uint24)
- **Token 0:** 0x0f47e03a0383396635846f8495003fc478b71bca
- **Token 1:** 0x9142fa65aaef921aea2127e88758adee0510a0f0
- **Fee:** 500
- **Pool recorded in original evidence:** 0x029603931809d430ae47d2f55212cc0e89dbfd52
- **Comparison expectation:** 0x029603931809d430ae47d2f55212cc0e89dbfd52 (ORIGINAL_CAPTURE)
- **Observed pool:** UNAVAILABLE
- **Reason codes:** PUBLIC_MANIFEST_UNAVAILABLE, HTTP_STATUS_ERROR, CHAIN_ID_UNAVAILABLE, CHAIN_SELECTOR_UNAVAILABLE, REQUESTED_BLOCK_UNAVAILABLE, HEADER_UNAVAILABLE, CALL_IDENTITY_UNAVAILABLE, POOL_RESULT_UNAVAILABLE
- **Evidence SHA-256:** 0x41c8cd52735e76a759e3d93103f4cd6a77d0630f09593e5c9ca0612794880093
- **Manifest SHA-256:** 0x76b8666d4d9d7d91ef45bf110f6af1628114303c007da08ee59830d6b4aa72ad
- **Policy SHA-256:** 0xad5807237c0f0c157b513bf3df554ecba13dcded0601d7540f0a836cc55fbc86

## Declared execution metadata

- **Workflow revision:** f7e4048389d3acf85d7c16020b34990c03fde93f
- **CRE CLI:** NOT_EXECUTED
- **CRE SDK:** NOT_EXECUTED
- **RPC provider classification:** TENDERLY_PUBLIC_SEPOLIA

## Limitations

- RPC_REHEARSAL: this result records direct RPC rehearsal, not an executed CRE CLI simulation.
- This local result file is self-reported. Its contents and source revision are not authenticated Chainlink or DON attestations.
- The consumer checks source evidence binding and recomputes the comparison; it cannot prove that the supplied observation was obtained by executing CRE.
- A manifest or evidence digest establishes artifact integrity, not Ethereum consensus authenticity or provider independence.
- The CRE read is requested by block number. A separate matching block header does not turn it into an EIP-1898 block-hash-bound contract read.
- Protocol identity corroboration does not establish transaction-boundary balances, reserves, token semantics or original trading intent.
- The core financial-policy report is reproduced unchanged. External corroboration cannot upgrade an UNKNOWN or override a VIOLATION.
- Only Uniswap factory pool identity is compared; the financial-policy verdict is unchanged.
- The EVM call is bound to a block number; its separately observed header is not block-hash binding for that call.
- Chain ID is selected through the configured network/chain selector; no consensus authentication.
- An artifact digest establishes integrity, not source authenticity or Ethereum consensus.
- RPC observations are trusted provider responses, not transaction-boundary balance or reserve proofs.
- This observation uses the same Tenderly provider as the retained capture; independent-source validation is not established.
- RPC_REHEARSAL uses ordinary HTTP/RPC code; this result is not CRE CLI simulation evidence.
