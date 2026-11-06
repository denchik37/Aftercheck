import {
  CronCapability, EVMClient, HTTPClient, Runner, blockNumber, bytesToHex,
  consensusIdenticalAggregation, encodeCallMsg, getNetwork, handler,
  protoBigIntToBigint, type HTTPSendRequester, type Runtime,
} from '@chainlink/cre-sdk';
import {sha256} from '@noble/hashes/sha2.js';
import {bytesToHex as hashHex, utf8ToBytes} from '@noble/hashes/utils.js';
import type {Address, Hex} from 'viem';
import {CRE_RESULT_CHUNK_BYTES, CRE_RESULT_CHUNK_MARKER, MAX_CRE_JSON_BYTES, canonicalJson, compareObservation, type Observation} from '../shared.ts';
import {
  MAX_MANIFEST_BYTES, missingManifestObservation, parseWorkflowConfig,
  validateFetchedManifest, type ManifestFetch, type WorkflowConfig,
} from '../config.ts';

const sha256Text = (text: string): string => '0x' + hashHex(sha256(utf8ToBytes(text)));

/** Runs inside CRE's HTTP node callback; only validated data reaches aggregation. */
const fetchManifest = (sender: HTTPSendRequester, config: WorkflowConfig): string => {
  try {
    // The official HTTP capability rejects redirects; the initial URL is also
    // restricted to an immutable public source by parseWorkflowConfig.
    const response = sender.sendRequest({url: config.manifestUrl, method: 'GET', timeout: '8s'}).result();
    if (response.body.length > MAX_MANIFEST_BYTES) return 'MANIFEST_INVALID';
    const fetched = validateFetchedManifest(response.statusCode, new TextDecoder().decode(response.body), config.expectedManifest, sha256Text);
    // SDK 1.23.0 consensus values do not serialize null. A validated canonical
    // manifest string or stable error code is an explicitly supported primitive.
    return fetched.manifestFetch === 'VERIFIED' ? canonicalJson(fetched.manifest) : fetched.errorCode;
  } catch {
    return 'HTTP_FETCH_FAILED';
  }
};

const onCron = (runtime: Runtime<WorkflowConfig>): string => {
  const config = runtime.config;
  let fetched: ManifestFetch;
  try {
    const aggregated = new HTTPClient().sendRequest(runtime, fetchManifest, consensusIdenticalAggregation<string>())(config).result();
    if (aggregated === 'HTTP_FETCH_FAILED' || aggregated === 'HTTP_STATUS_ERROR') {
      fetched = {manifestFetch: 'UNAVAILABLE', manifest: null, errorCode: aggregated};
    } else if (aggregated === 'MANIFEST_INVALID' || aggregated === 'MANIFEST_DIGEST_MISMATCH') {
      fetched = {manifestFetch: 'INVALID', manifest: null, errorCode: aggregated};
    } else {
      // Revalidate the agreed primitive at the capability boundary as well.
      fetched = validateFetchedManifest(200, aggregated, config.expectedManifest, sha256Text);
    }
  } catch {
    fetched = {manifestFetch: 'UNAVAILABLE', manifest: null, errorCode: 'HTTP_FETCH_FAILED'};
  }
  let observation: Observation;
  if (fetched.manifestFetch !== 'VERIFIED') {
    observation = missingManifestObservation(fetched);
  } else {
    const manifest = fetched.manifest;
    const network = getNetwork({chainFamily: 'evm', chainSelectorName: 'ethereum-testnet-sepolia'});
    observation = {
      availability: 'AVAILABLE', manifestFetch: 'VERIFIED',
      // This is the configured network identity, not an independent consensus proof.
      chainId: manifest.target.chainId, chainSelector: network?.chainSelector.selector.toString() ?? null,
      requestedBlockNumber: manifest.target.blockNumber, header: null,
      call: {to: manifest.call.factory, data: manifest.call.calldata, blockNumber: manifest.target.blockNumber},
      returnData: null, errorCode: null,
    };
    if (!network || network.chainSelector.selector.toString() !== manifest.target.chainSelector) {
      observation.availability = 'UNSUPPORTED';
      observation.errorCode = 'UNSUPPORTED_CHAIN';
    } else {
      const evm = new EVMClient(network.chainSelector.selector);
      const requestedBlock = blockNumber(BigInt(manifest.target.blockNumber));
      try {
        const header = evm.headerByNumber(runtime, {blockNumber: requestedBlock}).result().header;
        if (!header?.blockNumber || header.hash.length !== 32) throw new Error('HEADER_UNAVAILABLE');
        observation.header = {blockNumber: protoBigIntToBigint(header.blockNumber).toString(), blockHash: bytesToHex(header.hash)};
      } catch {
        observation.availability = 'UNAVAILABLE';
        observation.errorCode = 'HEADER_UNAVAILABLE';
      }
      try {
        const result = evm.callContract(runtime, {
          call: encodeCallMsg({from: '0x0000000000000000000000000000000000000000',
            to: manifest.call.factory as Address, data: manifest.call.calldata as Hex}),
          blockNumber: requestedBlock,
        }).result();
        // ABI return length is bounded before retaining external data.
        if (result.data.length > 512) throw new Error('EVM_READ_FAILED');
        observation.returnData = bytesToHex(result.data);
      } catch {
        observation.availability = 'UNAVAILABLE';
        observation.errorCode = 'EVM_READ_FAILED';
      }
    }
  }
  const result = compareObservation(config.expectedManifest, observation, config.metadata);
  // The official CRE service enforces a 1 KiB log-line limit. A complete result
  // (which includes the manifest) exceeds that limit. Emit small, numbered,
  // SHA-256-bound hex fragments rather than an silently truncated JSON line.
  // This is an output transport, not a substitute for full result validation.
  const resultBytes = utf8ToBytes(canonicalJson(result));
  if (resultBytes.length === 0 || resultBytes.length > MAX_CRE_JSON_BYTES) throw new Error('CRE_RESULT_TOO_LARGE');
  const digest = hashHex(sha256(resultBytes));
  const total = Math.ceil(resultBytes.length / CRE_RESULT_CHUNK_BYTES);
  for (let index = 0; index < total; index++) {
    const fragment = resultBytes.subarray(index * CRE_RESULT_CHUNK_BYTES, (index + 1) * CRE_RESULT_CHUNK_BYTES);
    runtime.log(`${CRE_RESULT_CHUNK_MARKER}v1:${index + 1}/${total}:${digest}:${hashHex(fragment)}`);
  }
  return result.status;
};

export async function main() {
  const runner = await Runner.newRunner<WorkflowConfig>({
    configParser: bytes => {
      if (bytes.length > MAX_MANIFEST_BYTES) throw new Error('CRE_CONFIG_TOO_LARGE');
      return parseWorkflowConfig(new TextDecoder().decode(bytes), sha256Text);
    },
  });
  await runner.run(config => [handler(new CronCapability().trigger({schedule: config.schedule}), onCron)]);
}
