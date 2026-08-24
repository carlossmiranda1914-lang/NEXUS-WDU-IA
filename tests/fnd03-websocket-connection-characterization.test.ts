import assert from 'node:assert/strict';
import fs from 'node:fs';
import { EventEmitter } from 'node:events';
import { SchoolTaskWebSocketManager } from '../src/modules/school-tasks/websocket-manager.ts';

const source = fs.readFileSync('server.ts', 'utf8');
const connection = source.slice(source.indexOf("wss.on('connection'"), source.indexOf("wss.on('connection'") + 1200);
assert.match(connection, /verifyIdToken/);
assert.match(connection, /resolveInstitutionalContext/);
assert.match(connection, /ws\.close/);

class Socket extends EventEmitter { readyState = 1; sent: string[] = []; send(value: string) { this.sent.push(value); } }
const context = (institutionId: string, role: any = 'institution_admin') => ({ personId: 'person', personName: 'actor', identityEmail: null, membershipId: `membership-${institutionId}`, institutionId, institutionName: institutionId, institutionSlug: institutionId, role });

const oldSocket = new Socket();
SchoolTaskWebSocketManager.handleConnection(oldSocket as any, context('institution-a'));
oldSocket.emit('close');
const newSocket = new Socket();
SchoolTaskWebSocketManager.handleConnection(newSocket as any, context('institution-b', 'teacher'));
newSocket.sent = [];
SchoolTaskWebSocketManager.broadcast('institution-a', 'EVENT', {});
assert.equal(newSocket.sent.length, 0, 'reconnect must not retain the prior institution');
SchoolTaskWebSocketManager.broadcast('institution-b', 'EVENT', {});
assert.equal(newSocket.sent.length, 1, 'new connection receives only its selected membership context');
newSocket.emit('message', Buffer.from(JSON.stringify({ type: 'SUBSCRIBE', tenantId: 'institution-a' })));
assert.match(newSocket.sent.at(-1)!, /Instituição não autorizada/);
newSocket.emit('close');
console.log('FND-03 WebSocket direct connection characterization: PASS.');
