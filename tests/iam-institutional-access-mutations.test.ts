import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { IamMembershipMutationError } from '../src/modules/iam/iam-read-client.ts';
import { mutationErrorMessage } from '../src/components/InstitutionalAccessWorkspace.tsx';

const source = await readFile(new URL('../src/components/InstitutionalAccessWorkspace.tsx', import.meta.url), 'utf8');
assert.match(source, /if \(!selected \|\| !dialog \|\| submitting/);
assert.match(source, /await changeInstitutionMembershipRole[\s\S]*expectedVersion: selected\.version/);
assert.match(source, /await revokeInstitutionMembership[\s\S]*expectedVersion: selected\.version/);
assert.ok(source.indexOf('await refreshAuthoritatively();') < source.indexOf("setNotice(dialog === 'role'"), 'Success must follow authoritative refresh.');
assert.match(source, /submitError\.code === 'VERSION_CONFLICT'[\s\S]*await refreshAuthoritatively\(\)/);
assert.doesNotMatch(source, /Platform Admin|users\.role|deletePerson|deleteIdentity/);
assert.equal(mutationErrorMessage(new IamMembershipMutationError(409, 'LAST_ADMIN_PROTECTED')), 'Não é possível remover o último administrador ativo desta instituição.');
assert.match(mutationErrorMessage(new IamMembershipMutationError(409, 'VERSION_CONFLICT')), /lista foi atualizada/);
assert.match(mutationErrorMessage(new IamMembershipMutationError(403, 'UNAUTHORIZED')), /não tem autorização/i);
console.log('IAM institutional access mutation tests passed.');
