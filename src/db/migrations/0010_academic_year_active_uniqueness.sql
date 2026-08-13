-- AY-1: temporal integrity for institutional academic years.
DO $$
BEGIN
  IF EXISTS (
    SELECT institution_id
      FROM academic_years
     WHERE status = 'active'
     GROUP BY institution_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'AY-1 migration blocked: an institution has more than one active academic year';
  END IF;
END
$$;

CREATE UNIQUE INDEX academic_years_one_active_per_institution_unique
  ON academic_years (institution_id)
  WHERE status = 'active';
