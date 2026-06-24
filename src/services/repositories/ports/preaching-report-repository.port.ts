export type PreachingReportSubmissionRecord = {
  id: string;
  data: Record<string, unknown>;
};

export interface PreachingReportRepository {
  getSubmission(
    congregationId: string,
    monthId: string,
    userId: string
  ): Promise<PreachingReportSubmissionRecord | null>;
  listMonthlySubmissions(
    congregationId: string,
    monthId: string
  ): Promise<PreachingReportSubmissionRecord[]>;
  upsertSubmission(
    congregationId: string,
    monthId: string,
    userId: string,
    payload: Record<string, unknown>,
    options?: { includeSubmittedAt?: boolean }
  ): Promise<void>;
}
