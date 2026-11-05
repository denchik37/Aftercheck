# Aftercheck

**Experimental prototype · Initialized 5 November 2026**

Aftercheck explores read-only verification of EVM transaction outcomes, with an emphasis on exact financial quantities, transparent evidence, and reproducible reports.

## Status

Project initialized. No working verifier, protocol integration, test suite, or deployment is claimed yet.

## Development principles

- **Read-only by design:** no signing, custody, or transaction execution.
- **Evidence first:** distinguish observed effects from assumptions and missing information.
- **Exact arithmetic:** use integer amounts for financial checks.
- **Reproducibility:** make results inspectable and verifiable locally.
- **Honest limitations:** unsupported or incomplete evidence must not become a passing result.

## Next milestone

Define and implement one narrow, testable transaction-verification flow.
