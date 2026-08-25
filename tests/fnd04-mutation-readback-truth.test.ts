import assert from 'node:assert/strict';
import fs from 'node:fs';

const client = fs.readFileSync('src/supabaseClient.ts', 'utf8');
const tasks = fs.readFileSync('src/components/TasksCenter.tsx', 'utf8');
const app = fs.readFileSync('src/App.tsx', 'utf8');

assert.match(client, /export async function createLiveTaskAndReadBack/);
assert.match(client, /export async function updateLiveTaskAndReadBack/);
assert.match(client, /export async function getLiveTaskById/);
assert.match(client, /await getLiveTaskById\(created\.id\)/);
assert.match(client, /await getLiveTaskById\(id\)/);
assert.doesNotMatch(client, /upsertLiveTask[\s\S]{0,700}catch[\s\S]{0,200}return task/);

assert.match(tasks, /const \[isTaskMutationPending, setIsTaskMutationPending\]/);
assert.match(tasks, /await createLiveTaskAndReadBack\(newTask\)/);
assert.match(tasks, /await updateLiveTaskAndReadBack\(id, updated\)/);
assert.match(tasks, /await getLiveTaskById\(id\)/);
assert.doesNotMatch(tasks, /setTasks\(prev => \[newTask, \.\.\.prev\]\);[\s\S]{0,300}upsertLiveTask/);
assert.match(app, /Comunicações institucionais indisponíveis/);
assert.doesNotMatch(app, /activeTab === 'communications'[\s\S]{0,700}<CommunicationCenter/);

console.log('FND-04 mutation success/read-back truth contract: PASS.');
