import { Timestamp } from 'firebase/firestore';

export type CongregationEventType =
  | 'conmemoracion'
  | 'asamblea_circuito'
  | 'asamblea_regional'
  | 'visita_superintendente'
  | 'reunion_especial'
  | 'capacitacion';

export interface CongregationEvent {
  id: string;
  congregationId: string;
  type: CongregationEventType;
  title?: string;
  superintendentName?: string;
  superintendentWifeName?: string;
  startDate: Timestamp;
  endDate: Timestamp;
  deleteAt: Timestamp;
  location?: string;
  color: string;
  createdBy: string;
  updatedBy?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type CongregationEventFormValues = {
  type: CongregationEventType;
  title: string;
  superintendentName: string;
  superintendentWifeName: string;
  startDate: string;
  endDate: string;
  location: string;
};

export const EVENT_TYPE_LABELS: Record<CongregationEventType, string> = {
  conmemoracion: 'Conmemoracion',
  asamblea_circuito: 'Asamblea de Circuito',
  asamblea_regional: 'Asamblea Regional',
  visita_superintendente: 'Visita del Superintendente de Circuito',
  reunion_especial: 'Reunion Especial',
  capacitacion: 'Capacitacion',
};

export const EVENT_TYPE_COLORS: Record<CongregationEventType, string> = {
  conmemoracion: '#8B1E3F',
  asamblea_circuito: '#2563EB',
  asamblea_regional: '#7C3AED',
  visita_superintendente: '#16A34A',
  reunion_especial: '#F97316',
  capacitacion: '#0D9488',
};

export const SINGLE_DAY_EVENT_TYPES: CongregationEventType[] = [
  'conmemoracion',
  'asamblea_circuito',
];

export const OPTIONAL_END_DATE_EVENT_TYPES: CongregationEventType[] = [
  'reunion_especial',
  'capacitacion',
];
