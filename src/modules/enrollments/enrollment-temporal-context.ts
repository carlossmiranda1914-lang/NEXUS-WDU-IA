import type { EnrollmentTemporalContext } from './enrollment-temporal-context-model.ts';

type QueryResult<Row> = { rows: Row[] };
type Queryable = { query<Row = any>(text: string, values?: unknown[]): Promise<QueryResult<Row>> };
type YearRow = { id: string; name: string; starts_on: string | Date; ends_on: string | Date; status: 'active' };
type OfferRow = { id: string; name: string; code: string; academic_year_id: string };

function dateOnly(value: string | Date): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

const ACTIVE_YEAR_QUERY = [
  'SELECT id, name, starts_on, ends_on, status',
  'FROM academic_years',
  "WHERE institution_id = $1 AND status = 'active'",
  'ORDER BY starts_on DESC',
  'LIMIT 1',
].join(' ');

const ACTIVE_OFFERS_QUERY = [
  'SELECT id, name, code, academic_year_id',
  'FROM enrollment_offers',
  'WHERE institution_id = $1',
  'AND academic_year_id = $2',
  "AND status = 'active'",
  'ORDER BY name ASC',
].join(' ');

export async function resolveEnrollmentTemporalContext(db: Queryable, institutionId: string): Promise<EnrollmentTemporalContext> {
  const yearResult = await db.query<YearRow>(ACTIVE_YEAR_QUERY, [institutionId]);
  const year = yearResult.rows[0];
  if (!year) return { academicYear: null, offers: [] };

  const offerResult = await db.query<OfferRow>(ACTIVE_OFFERS_QUERY, [institutionId, year.id]);
  return {
    academicYear: {
      id: year.id,
      name: year.name,
      startsOn: dateOnly(year.starts_on),
      endsOn: dateOnly(year.ends_on),
      status: 'active',
    },
    offers: offerResult.rows.map((offer) => ({
      id: offer.id,
      name: offer.name,
      code: offer.code,
      academicYearId: offer.academic_year_id,
    })),
  };
}
