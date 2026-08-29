-- STUDENT-360-01: bounded, tenant-scoped source reads; no projection persistence.
CREATE INDEX student_context_enrollment_history_idx
  ON enrollment_applications (institution_id, student_person_id, academic_year_id, created_at DESC);

CREATE INDEX student_context_placement_history_idx
  ON student_academic_placements (institution_id, student_person_id, academic_year_id, created_at DESC);
