import { canTransitionEnrollment } from '../src/modules/enrollments/enrollment-policy.ts';
import { canPrepareTransferOut, canTransitionTransferOut, isTransferOutStatus } from '../src/modules/enrollments/transfer-out-policy.ts';
function expect(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
expect(isTransferOutStatus('approved') && !isTransferOutStatus('active'), 'Transfer status parser must be closed.');
expect(canPrepareTransferOut('secretariat'), 'Secretariat prepares transfer-out.');
expect(!canTransitionTransferOut('secretariat', 'submitted', 'approved'), 'Secretariat must not approve transfer-out.');
expect(canTransitionTransferOut('director', 'submitted', 'approved'), 'Director approves transfer-out.');
expect(canTransitionTransferOut('institution_admin', 'submitted', 'rejected'), 'Institution admin rejects transfer-out.');
expect(!canTransitionTransferOut('teacher', 'draft', 'submitted'), 'Teacher cannot manage transfer-out.');
expect(canTransitionEnrollment('director', 'active', 'transferred_out'), 'Only leadership may apply the explicit transferred-out enrollment state.');
expect(!canTransitionEnrollment('secretariat', 'active', 'transferred_out'), 'Secretariat cannot close enrollment through transfer-out.');
console.log('F04 transfer-out policy passed (8 assertions).');
