export type ActiveAcademicYearContext = {
  id: string;
  name: string;
  startsOn: string;
  endsOn: string;
  status: 'active';
};

export type ActiveEnrollmentOfferContext = {
  id: string;
  name: string;
  code: string;
  academicYearId: string;
};

export type EnrollmentTemporalContext = {
  academicYear: ActiveAcademicYearContext | null;
  offers: ActiveEnrollmentOfferContext[];
};

export function emptyEnrollmentTemporalContext(): EnrollmentTemporalContext {
  return { academicYear: null, offers: [] };
}
