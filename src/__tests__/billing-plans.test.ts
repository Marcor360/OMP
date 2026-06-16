import {
  BILLING_PLAN_LABELS,
  BILLING_PLAN_LIMITS,
  BILLING_PLANS,
} from '@/src/types/billing';

describe('billing plans', () => {
  it('keeps active-user limits aligned with public plan keys', () => {
    expect(BILLING_PLANS).toEqual(['omp_80', 'omp_150', 'omp_250']);
    expect(BILLING_PLAN_LIMITS).toEqual({
      omp_80: 80,
      omp_150: 150,
      omp_250: 250,
    });
  });

  it('uses labels that match the plan capacity', () => {
    expect(BILLING_PLAN_LABELS).toEqual({
      omp_80: 'OMP 80',
      omp_150: 'OMP 150',
      omp_250: 'OMP 250',
    });
  });
});
