import {Timestamp} from "firebase-admin/firestore";
import {resolveAssignmentMeetingDate} from "../modules/notifications/notification.helpers";

describe("assignment notification date metadata", () => {
  it("keeps a Timestamp queryable and a separate display label", () => {
    const date = Timestamp.fromDate(new Date("2026-07-20T12:00:00.000Z"));
    const result = resolveAssignmentMeetingDate({date});
    expect(result.meetingDate?.toMillis()).toBe(date.toMillis());
    expect(result.meetingDateLabel).toBe("2026-07-20");
  });

  it("converts a legacy ISO string without querying the display label", () => {
    const result = resolveAssignmentMeetingDate({date: "2026-07-20"});
    expect(result.meetingDate).toBeInstanceOf(Timestamp);
    expect(result.meetingDateLabel).toBe("2026-07-20");
  });

  it("preserves a localized legacy label but does not invent a Timestamp", () => {
    const result = resolveAssignmentMeetingDate({date: "20 de julio de 2026"});
    expect(result.meetingDate).toBeNull();
    expect(result.meetingDateLabel).toBe("20 de julio de 2026");
  });
});
