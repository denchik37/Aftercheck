# Optional CRE integration: third-party software

Reviewed against the pinned packages and upstream release licenses on 6 November 2026. This integration is an experimental, nonproduction, read-only hackathon workflow. The repository's license does not replace the separate licenses of these dependencies and development tools.

| Component | Pinned version | Reviewed license | Role |
| --- | --- | --- | --- |
| `@chainlink/cre-sdk` | 1.23.0 | Business Source License 1.1 (`BUSL-1.1`) | Optional workflow SDK |
| `@chainlink/cre-sdk-javy-plugin` | 1.7.0 | Business Source License 1.1 (`BUSL-1.1`) | SDK's TypeScript/WASM compiler plugin |
| CRE CLI | 1.39.0 | MIT | Official local simulator and workflow compiler entry point |
| Bun | 1.4.4 | Bun itself: MIT; linked components retain their own licenses | TypeScript compilation tool |
| Javy | 8.1.0 | Apache-2.0 with LLVM exceptions | JavaScript/QuickJS-to-WASM build tool used by the SDK |
| `viem` | 2.54.2 | MIT | ABI/network helpers in the optional workflow dependency graph |
| `@noble/hashes` | 2.2.0 | MIT | Portable SHA-256 for manifest integrity |
| TypeScript | 5.9.3 | Apache-2.0 | Development type checking |

## Chainlink SDK and compiler plugin

The installed SDK and plugin `LICENSE.md` files identify SmartContract Chainlink Limited SEZC as licensor. Their Business Source License grant includes nonproduction use, copying, modification and redistribution subject to the license conditions. The listed change date is 20 May 2029 and the listed change license is MIT. Those future terms do not make the current packages MIT-licensed.

This integration's nonproduction simulation stays within the stated nonproduction use grant. Production use is a separate licensing decision and is not established by this hackathon implementation or a successful simulation. Keep the original package license notices with any copies; do not relicense the SDK or plugin as the project's own code.

Authoritative package/source references:

- [SDK 1.23.0 source and license](https://github.com/smartcontractkit/cre-sdk-typescript/tree/v1.23.0/packages/cre-sdk).
- [Compiler plugin source and license in the same SDK release](https://github.com/smartcontractkit/cre-sdk-typescript/tree/v1.23.0/packages/cre-sdk-javy-plugin).
- Installed copies: `workflow/node_modules/@chainlink/cre-sdk/LICENSE.md` and `workflow/node_modules/@chainlink/cre-sdk-javy-plugin/LICENSE.md`.

## Tool and library notices

- [CRE CLI 1.39.0 license](https://github.com/smartcontractkit/cre-cli/blob/v1.39.0/LICENSE.md): MIT, copyright 2025 SmartContract. The installer retrieves the official binary; it does not vendor that binary in this repository.
- [Bun 1.4.4 licensing notice](https://github.com/oven-sh/bun/blob/bun-v1.4.4/LICENSE.md): Bun itself is MIT-licensed, but the binary includes JavaScriptCore/WebKit and additional components with their own terms, including LGPL terms. Consult that full upstream notice before redistributing Bun binaries. Installing the official development tool does not change those licenses.
- [Javy 8.1.0 license](https://github.com/bytecodealliance/javy/blob/v8.1.0/LICENSE.md): Apache-2.0 with LLVM exceptions. Preserve applicable license and notice requirements if redistributing the tool or non-exempt embedded portions.
- [viem 2.54.2 license](https://github.com/wevm/viem/blob/viem%402.54.2/LICENSE): MIT, copyright 2023–present weth, LLC. The installed `viem/LICENSE` is retained by the package manager.
- [noble-hashes 2.2.0 license](https://github.com/paulmillr/noble-hashes/blob/2.2.0/LICENSE): MIT, copyright 2022 Paul Miller. Preserve its copyright and permission notice in copies or substantial portions.
- [TypeScript 5.9.3 license](https://github.com/microsoft/TypeScript/blob/v5.9.3/LICENSE.txt): Apache-2.0.

The workflow dependency lockfile records the complete installed dependency graph. Transitive dependencies retain their individual package licenses. This table is not a blanket MIT assertion for that graph, a production-use clearance, or a redistribution license for all downloaded tools.

## Public implementation references

The workflow uses the public SDK API patterns documented in Chainlink's [HTTP GET guide](https://docs.chain.link/cre/guides/workflow/using-http-client/get-request-ts), [EVM read guide](https://docs.chain.link/cre/guides/workflow/using-evm-client/onchain-read-ts), [project configuration reference](https://docs.chain.link/cre/reference/project-configuration-ts), and [simulation guide](https://docs.chain.link/cre/guides/operations/simulating-workflows). Actual package APIs, compiler execution, and retained test logs control compatibility claims.
