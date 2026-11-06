# Chainlink CRE — ETHGlobal Mumbai 2026 submission packet

**Partner:** Chainlink · **Best workflow with CRE** (not the CCIP 2.0 prize).
**Selected event track:** Start from Scratch / Classic (fixed).
**Technical status:** CRE01–CRE05 evidenced with a **successful local official CRE CLI simulation**.
**External status:** Hacker Dashboard submission, partner selection, Classic eligibility and prize acceptance **not verified**.

## Ready-to-paste partner-specific description

> Aftercheck is a read-only, local-first checker of a narrow Uniswap v3 swap against a declared financial policy. A successful transaction receipt doesn't establish that the broader policy was met, so Aftercheck separates execution, support, evidence coverage, and financial verdict and exports reports that can be independently replayed.
>
> We added a meaningful optional Chainlink Runtime Environment (CRE) workflow: its **HTTP capability** fetches an immutable, public evidence manifest; its **EVM capability** makes a block-number-bound historical call to Uniswap v3's factory on Ethereum Sepolia and retrieves that block's header separately. It compares the returned `getPool` address with the manifest, producing an explicit `MATCH`, `MISMATCH`, or `UNAVAILABLE` result. Aftercheck consumes that result as a separate corroboration appendix **without changing the original financial-policy verdict**.
>
> With **CRE CLI 1.39.0 and SDK 1.23.0**, a locally authenticated official simulator run produced three validated cases: **MATCH** for the historical pool, **MISMATCH** for a deliberately altered expected pool, and **UNAVAILABLE** for a missing HTTPS manifest. The exact source revision, full results, execution JSON, sanitized CLI logs and integrity digests are public. CRE is used for protocol-identity corroboration, not a wallet-balance/state proof; the local simulation is **not** a deployed DON attestation.

## Sources and direct judge links

| What a judge needs | Public source |
|---|---|
| Repository | [denchik37/aftercheck](https://github.com/denchik37/aftercheck) |
| CRE workflow source | [`integrations/cre/workflow/main.ts`](../integrations/cre/workflow/main.ts) |
| CRE config and approved public source | [`integrations/cre/project.yaml`](../integrations/cre/project.yaml), [`integrations/cre/config.ts`](../integrations/cre/config.ts), [fixed manifests](../integrations/cre/public) |
| Strict comparison / complete manifest checks | [`integrations/cre/shared.ts`](../integrations/cre/shared.ts), [`scripts/cre-manifest.mjs`](../scripts/cre-manifest.mjs) |
| Official simulator and strict parser | [`scripts/cre-simulate.mjs`](../scripts/cre-simulate.mjs) |
| Aftercheck report consumer | [`src/corroboration.ts`](../src/corroboration.ts), [`scripts/cre-consume.mjs`](../scripts/cre-consume.mjs) |
| **Verified official simulation evidence** | [7 November results, actual logs, execution records, hashes](evidence/cre/official-2026-11-07/README.md) |
| Public core interface (the optional CRE CLI is separate) | [Aftercheck browser inspector](https://aftercheck-g4nsb.ondigitalocean.app/) — separately verified at deployed source `f4fac3b8`; do **not** claim this hosted browser renders the CRE appendix |
| Reproduction and trust boundary | [`CRE_INTEGRATION.md`](CRE_INTEGRATION.md) |
| Sponsor requirements | [ETHGlobal Chainlink prize](https://ethglobal.com/events/mumbai/prizes/chainlink), [official CRE overview](https://docs.chain.link/cre/overview) |

### Exact demonstration identity

- Network: **Ethereum Sepolia**, EVM chain ID `11155111`, CRE selector `16015286601757825753`.
- Historical **third-party** transaction: `0x608ca58e7d01dbe0c7fe48af8c0bb9f2bddcf07ccc36f5c28d033bc8d198d5e9`; block **7689923**, header hash `0x6526359f4e3c5e1db4d70ecef4510b8f510fd1e05e3dce986a9de32bd7fa7a34`.
- Uniswap v3 factory: `0x0227628f3f023bb0b980b67d528571c95c6dac1c`; actual recorded pool: `0x029603931809d430ae47d2f55212cc0e89dbfd52`; fee **500**.
- Original public capture digest: `0x41c8cd52735e76a759e3d93103f4cd6a77d0630f09593e5c9ca0612794880093`.
- Actual official simulator code revision: [`1ad2dd1ba629bd0751748a7451619cfe8c5d488d`](https://github.com/denchik37/aftercheck/commit/1ad2dd1ba629bd0751748a7451619cfe8c5d488d).
- **No new swap executed**, no asset movement, no deployed CRE workflow, and no wallet signing authority in the verifier.

## Reproduce locally

Install Node.js 24+, Bun **1.4.4**, CRE CLI **1.39.0** and Git; authenticate privately with `cre login` on the execution machine (deployment approval **not** needed for simulation). From the repository root:

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm --prefix integrations/cre/workflow ci --ignore-scripts --no-audit --no-fund
npm run cre:manifest
npm --prefix integrations/cre/workflow run build
npm run cre:simulate -- --manifest integrations/cre/public/reference.json --manifest-url https://raw.githubusercontent.com/denchik37/aftercheck/2b86229b8db8e4cf2217de73aa4ab4d9ef9f8a4d/integrations/cre/public/reference.json --output output/cre/official-reference-new
npm run cre:consume -- examples/sepolia/evidence.json examples/sepolia/policy-pass.json integrations/cre/public/reference.json output/cre/official-reference-new/result.json output/cre/official-reference-new/aftercheck
```

The two other scenario commands are in [`CRE_INTEGRATION.md`](CRE_INTEGRATION.md). The actual previously recorded source-bound results may also be consumed **offline** from [`evidence/cre/official-2026-11-07`](evidence/cre/official-2026-11-07/README.md) without CRE credentials; this is a replay of **authentic recorded simulator output**, **not** a new simulator run. `npm run cre:demo`, separately, replays **older RPC_REHEARSAL** data and must be labelled that way.

## Human-narrated main-video segment — final 18-second insert

Use the [**single 2:58 ETHGlobal master-video direction**](ETHGLOBAL_SUBMISSION_HANDOFF.md#one-final-master-video--target-258-not-separate-sponsor-videos) instead of adding another standalone partner video. After the real offline CLI replay, allocate **2:36–2:54** to Chainlink:

- **2:36–2:40:** actual CRE source/diagram: immutable public HTTPS manifest → Sepolia factory `getPool`.
- **2:40–2:49:** recorded official `CRE_CLI_SIMULATION` output: reference `MATCH`, deliberate `MISMATCH`, missing-manifest `UNAVAILABLE`. Show unchanged original core `PASS`.
- **2:49–2:54:** title card/label: **Local CRE CLI simulation · not DON deployment or wallet-balance proof**. Evidence: [7 November simulator logs](evidence/cre/official-2026-11-07/README.md).

**Human narration (approximately 36 words):** “Chainlink CRE fetches public evidence and reads the historical Uniswap pool. Our official simulation returned MATCH, deliberate MISMATCH, and UNAVAILABLE for a missing manifest. The core policy verdict stays unchanged.”

Use natural-speed footage and the presenter's genuine voice; the [ETHGlobal video guide](https://ethglobal.com/events/mumbai/info/details) prohibits AI voiceovers. This is an *editing directive*, not a claim that a final MP4 exists or has been uploaded.

## Chainlink partner submission checklist

- **Technically evidenced:** CRE workflow combines external HTTPS with historical Sepolia EVM; real official CRE CLI simulation; meaningful application consumption; public reproducible source and logs; honest limitations.
- **Owner/organizer gate:** the selected **Classic** track's [current rules](https://ethglobal.com/events/mumbai/info/details) prohibit project-specific designs before kickoff. Some detailed preparation originated on **28 October 2026**. Their permissible use and required disclosure are unresolved; a later regenerated file or new repository does not erase actual input provenance. Disclose accurately and obtain organizer confirmation rather than certifying eligibility without it.
- **Owner dashboard action:** submit a real project through [ETHGlobal Hacker Dashboard](https://ethglobal.com/events/mumbai/info/details); add repository and a **human-narrated 2–4-minute video**; select **Chainlink / Best workflow with CRE** as the third partner **without dropping Uniswap and EF** if those remain your selections. Maximum **three** partners. Add precise technical evidence link above. Record final submission URL, selected partner names and confirmation. No submission confirmation has been observed in this work.
- **Other sponsor actions remain separate:** confirm Uniswap Developer Feedback Form and EF CROPS video-specific requirements; this CRE checklist does not satisfy them by implication.
- **Deadline:** current official guide says **Sunday 8 November 2026, 09:00 IST**. The older project documents' 7 November deadline was a dated snapshot; verify the actual Hacker Dashboard before finalizing.

## Specific developer feedback to Chainlink (observed, not promotional)

The official CRE CLI/SDK supplied a real local simulator without deployment approval, with successful public HTTPS and historical Sepolia EVM calls. Actual integration friction included first-time login/MFA setup, unavailable API-key creation before deploy access, CRE v1.39.0 leaving a `.cre_build_tmp.js` file after simulation, a **1 KB log-line limit** that truncated an initially single-line 3.3 KB JSON result, and Windows-specific Git LF/CRLF manifest-byte handling. Aftercheck corrected this with explicit temporary-file handling, verified LF manifest checkout, 256-byte digest-framed result fragments and strict reassembly checks. Most useful documentation improvement: **a prominent simulator log-size example showing structured multi-line result reporting and how to retain complete authenticated reproduction artifacts**.

This is an experimental, un-audited read-only verifier. Reported `MATCH` only corroborates one narrow pool-identity observation under provider assumptions; it does not prove financial safety, original user intent, or Ethereum consensus.
