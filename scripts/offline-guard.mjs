// Rehearsal/test guard, not an operating-system security boundary. The replay
// process must not use fetch or these common Node networking entry points.
import net from 'node:net';
import http from 'node:http';
import https from 'node:https';
import dns from 'node:dns';

const forbidden = () => { throw new Error('NETWORK_FORBIDDEN_DURING_REPLAY'); };
globalThis.fetch = forbidden;
net.Socket.prototype.connect = forbidden;
http.request = http.get = forbidden;
https.request = https.get = forbidden;
dns.lookup = dns.resolve = forbidden;
dns.promises.lookup = dns.promises.resolve = forbidden;
