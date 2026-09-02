/**
 * UI-only request ownership. It never advances Enrollment or identity state;
 * it merely prevents superseded responses from being rendered as current.
 */
export function createLatestIdentityRequestGate() {
  let requestSequence = 0;
  let selectionSequence = 0;
  let selectedDecisionRef: string | null = null;

  return {
    begin(decisionRef: string | null = selectedDecisionRef) {
      const request = ++requestSequence;
      const selection = selectionSequence;
      return {
        isLatest: () => request === requestSequence
          && selection === selectionSequence
          && (!decisionRef || selectedDecisionRef === decisionRef),
      };
    },
    select(decisionRef: string | null) {
      requestSequence += 1;
      selectionSequence += 1;
      selectedDecisionRef = decisionRef;
    },
    adopt(decisionRef: string | null) {
      selectedDecisionRef = decisionRef;
    },
    invalidate() {
      requestSequence += 1;
      selectionSequence += 1;
      selectedDecisionRef = null;
    },
  };
}
