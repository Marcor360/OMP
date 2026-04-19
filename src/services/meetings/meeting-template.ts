import { MeetingProgramType } from '@/src/types/meeting/program';
import { getWeekStart } from '@/src/utils/dates/week-range';

export interface MeetingDateRange {
  startDate: Date;
  endDate: Date;
}

export interface MeetingTemplateUiConfig {
  weekHint: string;
}

export abstract class BaseMeetingTemplate {
  constructor(public readonly meetingType: MeetingProgramType) {}

  protected toWeekRange(weekStart: Date, startOffsetDays: number, endOffsetDays: number): MeetingDateRange {
    const normalizedWeekStart = getWeekStart(weekStart);
    const startDate = new Date(normalizedWeekStart);
    const endDate = new Date(normalizedWeekStart);

    startDate.setDate(startDate.getDate() + startOffsetDays);
    endDate.setDate(endDate.getDate() + endOffsetDays);
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(0, 0, 0, 0);

    return { startDate, endDate };
  }

  public abstract getMeetingDateRange(weekStart: Date): MeetingDateRange;

  public abstract getUiConfig(): MeetingTemplateUiConfig;
}

export class MidweekMeetingTemplate extends BaseMeetingTemplate {
  constructor() {
    super('midweek');
  }

  public getMeetingDateRange(weekStart: Date): MeetingDateRange {
    return this.toWeekRange(weekStart, 0, 4);
  }

  public getUiConfig(): MeetingTemplateUiConfig {
    return {
      weekHint: 'Entre semana: lunes a viernes',
    };
  }
}

export class WeekendMeetingTemplate extends BaseMeetingTemplate {
  constructor() {
    super('weekend');
  }

  public getMeetingDateRange(weekStart: Date): MeetingDateRange {
    return this.toWeekRange(weekStart, 5, 6);
  }

  public getUiConfig(): MeetingTemplateUiConfig {
    return {
      weekHint: 'Fin de semana: sabado y domingo',
    };
  }
}

export const resolveMeetingTemplate = (meetingType: MeetingProgramType): BaseMeetingTemplate =>
  meetingType === 'midweek' ? new MidweekMeetingTemplate() : new WeekendMeetingTemplate();
