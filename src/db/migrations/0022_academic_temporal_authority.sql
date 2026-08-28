-- ACADEMIC-01: additive temporal Academic Core authority. AcademicYear remains
-- the existing canonical authority; legacy teachers/classes JSON is untouched.
ALTER TABLE academic_years ADD COLUMN version BIGINT NOT NULL DEFAULT 1 CHECK (version > 0);
CREATE TABLE academic_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  code TEXT NOT NULL, name TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','retired')),
  version BIGINT NOT NULL DEFAULT 1 CHECK (version > 0), created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (institution_id, code), UNIQUE (institution_id, id)
);
CREATE TABLE academic_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  program_id UUID NOT NULL, code TEXT NOT NULL, name TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','retired')),
  version BIGINT NOT NULL DEFAULT 1 CHECK (version > 0), created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (institution_id, program_id, code), UNIQUE (institution_id, id), FOREIGN KEY (institution_id, program_id) REFERENCES academic_programs(institution_id,id) ON DELETE RESTRICT
);
ALTER TABLE academic_years ADD CONSTRAINT academic_years_institution_id_id_unique UNIQUE (institution_id,id);
CREATE TABLE academic_classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  academic_year_id UUID NOT NULL, program_id UUID NOT NULL, level_id UUID NOT NULL, code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','active','closed')), version BIGINT NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (institution_id, academic_year_id, program_id, level_id, code), UNIQUE (institution_id,id),
  FOREIGN KEY (institution_id,academic_year_id) REFERENCES academic_years(institution_id,id), FOREIGN KEY (institution_id,program_id) REFERENCES academic_programs(institution_id,id), FOREIGN KEY (institution_id,level_id) REFERENCES academic_levels(institution_id,id)
);
CREATE TABLE academic_subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  code TEXT NOT NULL, name TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','retired')), version BIGINT NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(institution_id,code), UNIQUE(institution_id,id)
);
CREATE TABLE academic_subject_offerings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), institution_id UUID NOT NULL, academic_year_id UUID NOT NULL, class_id UUID NOT NULL, subject_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','ended')), version BIGINT NOT NULL DEFAULT 1 CHECK(version>0), created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(institution_id,academic_year_id,class_id,subject_id), UNIQUE(institution_id,id), FOREIGN KEY(institution_id,academic_year_id) REFERENCES academic_years(institution_id,id), FOREIGN KEY(institution_id,class_id) REFERENCES academic_classes(institution_id,id), FOREIGN KEY(institution_id,subject_id) REFERENCES academic_subjects(institution_id,id)
);
CREATE TABLE teacher_assignments (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), institution_id UUID NOT NULL, academic_year_id UUID NOT NULL, class_id UUID NOT NULL, subject_offering_id UUID NOT NULL, teacher_person_id UUID NOT NULL REFERENCES people(id), effective_from DATE NOT NULL, effective_to DATE, status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('planned','active','replaced','ended')), version BIGINT NOT NULL DEFAULT 1 CHECK(version>0), created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), CHECK(effective_to IS NULL OR effective_to>=effective_from), UNIQUE(institution_id,id), FOREIGN KEY(institution_id,academic_year_id) REFERENCES academic_years(institution_id,id), FOREIGN KEY(institution_id,class_id) REFERENCES academic_classes(institution_id,id), FOREIGN KEY(institution_id,subject_offering_id) REFERENCES academic_subject_offerings(institution_id,id)
);
CREATE UNIQUE INDEX teacher_assignments_one_open_slot ON teacher_assignments(institution_id,subject_offering_id) WHERE status='active' AND effective_to IS NULL;
ALTER TABLE student_profiles ADD CONSTRAINT student_profiles_institution_id_person_id_unique UNIQUE(institution_id,person_id);
CREATE TABLE student_academic_placements (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), institution_id UUID NOT NULL, academic_year_id UUID NOT NULL, class_id UUID NOT NULL, student_person_id UUID NOT NULL, status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','ended')), version BIGINT NOT NULL DEFAULT 1 CHECK(version>0), created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(institution_id,id), FOREIGN KEY(institution_id,academic_year_id) REFERENCES academic_years(institution_id,id), FOREIGN KEY(institution_id,class_id) REFERENCES academic_classes(institution_id,id), FOREIGN KEY(institution_id,student_person_id) REFERENCES student_profiles(institution_id,person_id)
);
CREATE UNIQUE INDEX student_academic_placements_one_active_per_year ON student_academic_placements(institution_id,academic_year_id,student_person_id) WHERE status='active';
CREATE TABLE academic_events (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), institution_id UUID NOT NULL REFERENCES institutions(id), aggregate_type TEXT NOT NULL, aggregate_id UUID NOT NULL, actor_kind TEXT NOT NULL CHECK(actor_kind IN ('human','system')), actor_person_id UUID REFERENCES people(id), operation TEXT NOT NULL, correlation_id TEXT, metadata JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), CHECK((actor_kind='human' AND actor_person_id IS NOT NULL) OR (actor_kind='system' AND actor_person_id IS NULL)));
