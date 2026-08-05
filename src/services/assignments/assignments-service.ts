import type {
  Assignment,
  AssignmentStatus,
  CreateAssignmentDTO,
  CreateCleaningAssignmentDTO,
  UpdateAssignmentDTO,
} from '@/src/types/assignment';
import type {
  AssignmentFilters,
} from '@/src/services/assignments/assignment.mapper';
import {
  firestoreAssignmentRepository,
  type SubscribeToAssignmentsOptions,
} from '@/src/services/repositories/firestore/firestore-assignment-repository';
import type {
  AssignmentRepository,
  Unsubscribe,
} from '@/src/services/repositories/ports/assignment-repository.port';
import { AppError } from '@/src/utils/errors/errors';

export type { SubscribeToAssignmentsOptions };

type AssignmentRepositoryWithSubscribeOptions = Omit<
  AssignmentRepository,
  'subscribeToAssignments'
> & {
  subscribeToAssignments(
    congregationId: string,
    callback: (assignments: Assignment[]) => void,
    filters?: AssignmentFilters,
    onError?: (error: unknown) => void,
    options?: SubscribeToAssignmentsOptions
  ): Unsubscribe;
};

let assignmentRepository: AssignmentRepositoryWithSubscribeOptions =
  firestoreAssignmentRepository;

export const __setAssignmentRepositoryForTests = (
  repo: AssignmentRepositoryWithSubscribeOptions
): void => {
  assignmentRepository = repo;
};

export const __resetAssignmentRepositoryForTests = (): void => {
  assignmentRepository = firestoreAssignmentRepository;
};

const isInvalidRange = (startDate: Date, endDate: Date): boolean =>
  Number.isNaN(startDate.getTime()) ||
  Number.isNaN(endDate.getTime()) ||
  startDate > endDate;

const isBlank = (value: string | null | undefined): boolean =>
  !value || value.trim().length === 0;

const assertCreateAssignmentInput = (
  congregationId: string,
  meetingId: string,
  data: CreateAssignmentDTO
): void => {
  if (isBlank(congregationId)) {
    throw new Error('No hay congregacion activa.');
  }

  if (isBlank(meetingId)) {
    throw new Error('No hay reunion vinculada a la asignacion.');
  }

  if (isBlank(data.title)) {
    throw new Error('El titulo de la asignacion es obligatorio.');
  }

  if (isBlank(data.assignedToUid) || isBlank(data.assignedToName)) {
    throw new Error('La persona asignada es obligatoria.');
  }
};

const assertCleaningAssignmentInput = (
  congregationId: string,
  data: CreateCleaningAssignmentDTO
): void => {
  if (isBlank(congregationId)) {
    throw new Error('No hay congregacion activa.');
  }

  if (isBlank(data.title)) {
    throw new Error('El titulo de la asignacion es obligatorio.');
  }

  if (isBlank(data.cleaningGroupId) || isBlank(data.cleaningGroupName)) {
    throw new Error('El grupo de limpieza es obligatorio.');
  }
};

/** Obtiene una asignacion por ID dentro de la congregacion */
export const getAssignmentById = async (
  congregationId: string,
  assignmentId: string,
  meetingIdHint?: string
): Promise<Assignment | null> => {
  if (isBlank(congregationId) || isBlank(assignmentId)) {
    return null;
  }

  return assignmentRepository.getById(congregationId, assignmentId, meetingIdHint);
};

/** Obtiene todas las asignaciones de la congregacion */
export const getAllAssignments = async (congregationId: string): Promise<Assignment[]> => {
  if (isBlank(congregationId)) {
    return [];
  }

  return assignmentRepository.getAll(congregationId);
};

/** Obtiene asignaciones de un usuario especifico dentro de la congregacion */
export const getAssignmentsByUser = async (
  congregationId: string,
  uid: string
): Promise<Assignment[]> => {
  if (isBlank(congregationId) || isBlank(uid)) {
    return [];
  }

  return assignmentRepository.getByUser(congregationId, uid);
};

/** Obtiene asignaciones por estado dentro de la congregacion */
export const getAssignmentsByStatus = async (
  congregationId: string,
  status: AssignmentStatus
): Promise<Assignment[]> => {
  if (isBlank(congregationId)) {
    return [];
  }

  return assignmentRepository.getByStatus(congregationId, status);
};

/** Obtiene asignaciones del rango visible (semana/rango) */
export const getAssignmentsByWeek = async (
  congregationId: string,
  startDate: Date,
  endDate: Date,
  options?: {
    userUid?: string;
    status?: AssignmentStatus;
    forceServer?: boolean;
    maxMeetings?: number;
    perMeetingLimit?: number;
  }
): Promise<Assignment[]> => {
  if (isBlank(congregationId)) {
    return [];
  }

  if (isInvalidRange(startDate, endDate)) {
    return [];
  }

  return assignmentRepository.getByRange(congregationId, startDate, endDate, options);
};

/** Obtiene asignaciones de una reunion */
export const getAssignmentsByMeeting = async (
  congregationId: string,
  meetingId: string
): Promise<Assignment[]> => {
  if (isBlank(congregationId) || isBlank(meetingId)) {
    return [];
  }

  return assignmentRepository.getByMeeting(congregationId, meetingId);
};

/** Crea una asignacion en la subcoleccion de la reunion */
export const createAssignment = async (
  congregationId: string,
  meetingId: string,
  data: CreateAssignmentDTO,
  assignedByUid: string,
  assignedByName: string
): Promise<string> => {
  assertCreateAssignmentInput(congregationId, meetingId, data);

  return assignmentRepository.create(
    congregationId,
    meetingId,
    data,
    assignedByUid,
    assignedByName
  );
};

/** Crea una asignacion de limpieza para un grupo/familia completa. */
export const createCleaningGroupAssignment = async (
  congregationId: string,
  meetingId: string,
  data: CreateCleaningAssignmentDTO,
  assignedByUid: string,
  assignedByName: string
): Promise<string> => {
  assertCleaningAssignmentInput(congregationId, data);
  if (isBlank(meetingId)) {
    throw new AppError('La asignacion de limpieza requiere una reunion vinculada.');
  }

  return assignmentRepository.createCleaningGroup(
    congregationId,
    meetingId,
    data,
    assignedByUid,
    assignedByName
  );
};

/** Actualiza una asignacion */
export const updateAssignment = async (
  congregationId: string,
  meetingId: string,
  assignmentId: string,
  data: UpdateAssignmentDTO
): Promise<void> => {
  if (isBlank(congregationId) || isBlank(meetingId) || isBlank(assignmentId)) {
    return;
  }

  await assignmentRepository.update(congregationId, meetingId, assignmentId, data);
};

/** Elimina una asignacion */
export const deleteAssignment = async (
  congregationId: string,
  meetingId: string,
  assignmentId: string
): Promise<void> => {
  if (isBlank(congregationId) || isBlank(meetingId) || isBlank(assignmentId)) {
    return;
  }

  await assignmentRepository.delete(congregationId, meetingId, assignmentId);
};

/** Cuenta asignaciones por estado */
export const getAssignmentsCount = async (
  congregationId: string,
  status?: AssignmentStatus
): Promise<number> => {
  if (isBlank(congregationId)) {
    return 0;
  }

  return assignmentRepository.count(congregationId, status);
};

/**
 * Suscripcion consolidada en tiempo real de asignaciones por congregacion.
 * Escucha reuniones y crea listeners por subcoleccion assignments con limpieza completa.
 */
export const subscribeToAssignments = (
  congregationId: string,
  callback: (assignments: Assignment[]) => void,
  filters?: AssignmentFilters,
  onError?: (error: unknown) => void,
  options?: SubscribeToAssignmentsOptions
): Unsubscribe => {
  if (isBlank(congregationId)) {
    callback([]);
    return () => undefined;
  }

  return assignmentRepository.subscribeToAssignments(
    congregationId,
    callback,
    filters,
    onError,
    options
  );
};
