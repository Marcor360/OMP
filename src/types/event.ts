import { Timestamp } from 'firebase/firestore';

export type CongregationEventType =
  | 'conmemoracion'
  | 'asamblea_circuito'
  | 'asamblea_regional'
  | 'visita_superintendente'
  | 'reunion_especial'
  | 'capacitacion'
  | 'reunion_anual_precursores'
  | 'reunion_precursores_visita_superintendente'
  | 'reunion_ancianos_siervos_ministeriales';

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
  reunion_anual_precursores: 'Reunion Anual de Precursores',
  reunion_precursores_visita_superintendente: 'Reunion con Precursores - Visita del Superintendente',
  reunion_ancianos_siervos_ministeriales: 'Reunion con Ancianos y Siervos Ministeriales',
};

export const EVENT_TYPE_COLORS: Record<CongregationEventType, string> = {
  conmemoracion: '#8B1E3F',
  asamblea_circuito: '#2563EB',
  asamblea_regional: '#7C3AED',
  visita_superintendente: '#16A34A',
  reunion_especial: '#F97316',
  capacitacion: '#0D9488',
  reunion_anual_precursores: '#6366F1',
  reunion_precursores_visita_superintendente: '#0891B2',
  reunion_ancianos_siervos_ministeriales: '#9333EA',
};

export const SINGLE_DAY_EVENT_TYPES: CongregationEventType[] = [
  'conmemoracion',
  'asamblea_circuito',
  'reunion_anual_precursores',
  'reunion_precursores_visita_superintendente',
  'reunion_ancianos_siervos_ministeriales',
];

export const OPTIONAL_END_DATE_EVENT_TYPES: CongregationEventType[] = [
  'reunion_especial',
  'capacitacion',
];
