import { AssignmentCardEditorErrors } from '@/src/components/meetings/midweek/AssignmentCardEditor';
import { ActiveCongregationUser } from '@/src/services/users/active-users-service';
import { MeetingProgramSection } from '@/src/types/meeting/program';

import { normalizeText, programSectionToEditorSection } from './meeting-form.mapper';

export interface MeetingFormErrors {
  title?: string;
}

export interface PublishPanelItem {
  id: string;
  message: string;
}

export const toPanelItems = (messages: string[]): PublishPanelItem[] =>
  Array.from(new Set(messages.filter((item) => normalizeText(item))))
    .map((message) => message
      .replace('La reunion debe tener tipo.', 'Elige el tipo de reunion antes de publicar.')
      .replace('La reunion debe pertenecer a una congregacion valida.', 'No se encontro una congregacion valida para esta reunion.')
      .replace('La reunion debe tener una fecha valida.', 'Elige una fecha valida para la reunion.')
      .replace('La reunion debe incluir al menos una seccion.', 'Agrega al menos una seccion al programa.'))
    .map((message, index) => ({ id: `${index}-${message}`, message }));

export const validateMeetingTopLevel = (title: string): MeetingFormErrors => {
  const nextErrors: MeetingFormErrors = {};

  if (!normalizeText(title)) {
    nextErrors.title = 'El titulo es obligatorio.';
  }

  return nextErrors;
};

export const collectMissingAssignmentLabels = (sections: MeetingProgramSection[]): string[] => {
  const missing: string[] = [];

  sections
    .filter((section) => section.isEnabled !== false)
    .forEach((section) => {
      if (section.assignments.length === 0) {
        missing.push(`${section.title || 'Seccion sin nombre'}: falta agregar al menos una parte.`);
      }

      section.assignments.forEach((assignment) => {
        if (!normalizeText(assignment.title)) {
          missing.push(`${section.title || 'Seccion sin nombre'}: falta el titulo de una parte.`);
        }

        if (assignment.assignmentScope !== 'internal') {
          return;
        }

        assignment.assignees.forEach((assignee) => {
          if (assignee.assigneeType !== 'registeredUser' || !normalizeText(assignee.assigneeUserId ?? '')) {
            missing.push(`${assignment.title || section.title}: falta seleccionar un usuario.`);
          }
        });
      });
    });

  return Array.from(new Set(missing));
};

export const collectControlledFieldLabels = (sections: MeetingProgramSection[]): string[] =>
  Array.from(
    new Set(
      sections.flatMap((section) =>
        section.assignments
          .filter((assignment) => assignment.lockedFromMeetingEditor === true)
          .map((assignment) => `${section.title}: ${assignment.roleLabel ?? assignment.title}`)
      )
    )
  );

export const validateMidweekParticipantInputs = (params: {
  sections: MeetingProgramSection[];
  availableUsers: ActiveCongregationUser[];
  blockedOutgoingTalkUserIds: Set<string>;
}): string[] => {
  const errorsBuffer: string[] = [];
  const usersById = new Set(params.availableUsers.map((user) => user.uid));

  params.sections.forEach((section) => {
    if (section.isEnabled === false) {
      return;
    }

    const editorSection = programSectionToEditorSection(section);

    editorSection.items.forEach((assignment, assignmentIndex) => {
      const assignmentLabel = `${editorSection.title} - Parte ${assignmentIndex + 1}`;
      const participants =
        editorSection.id === 'livingAsChristians'
          ? assignment.participants.slice(0, 2)
          : assignment.participants;

      participants.forEach((participant, participantIndex) => {
        if (participant.mode === 'user') {
          const userId = normalizeText(participant.userId ?? '');
          if (!userId) {
            errorsBuffer.push(
              `${assignmentLabel}: Falta seleccionar usuario en participante ${participantIndex + 1}.`
            );
            return;
          }

          if (!usersById.has(userId)) {
            errorsBuffer.push(
              `${assignmentLabel}: El usuario del participante ${participantIndex + 1} no existe o esta inactivo.`
            );
          } else if (params.blockedOutgoingTalkUserIds.has(userId)) {
            errorsBuffer.push(
              `${assignmentLabel}: ${participant.displayName || 'El usuario'} no esta disponible por salida a discursar esta semana.`
            );
          }
          return;
        }

        const manualName = normalizeText(participant.displayName);
        if (!manualName) {
          errorsBuffer.push(
            `${assignmentLabel}: El nombre manual del participante ${participantIndex + 1} es obligatorio.`
          );
        }
      });

      if (editorSection.id === 'livingAsChristians' && assignment.participants.length > 2) {
        errorsBuffer.push(`${assignmentLabel}: Solo se permiten dos participantes.`);
      }
    });
  });

  return Array.from(new Set(errorsBuffer));
};

export const validateMidweekAssignmentTitles = (
  sections: MeetingProgramSection[]
): {
  errors: string[];
  assignmentErrors: Record<string, AssignmentCardEditorErrors>;
} => {
  const errorsBuffer: string[] = [];
  const nextAssignmentErrors: Record<string, AssignmentCardEditorErrors> = {};

  sections.forEach((section) => {
    if (section.isEnabled === false) {
      return;
    }

    section.assignments.forEach((assignment, assignmentIndex) => {
      if (normalizeText(assignment.title)) {
        return;
      }

      nextAssignmentErrors[assignment.assignmentKey] = {
        ...nextAssignmentErrors[assignment.assignmentKey],
        title: 'El titulo de la parte es obligatorio.',
      };
      errorsBuffer.push(
        `${section.title || 'Seccion sin titulo'} - Parte ${assignmentIndex + 1}: falta el titulo.`
      );
    });
  });

  return {
    errors: Array.from(new Set(errorsBuffer)),
    assignmentErrors: nextAssignmentErrors,
  };
};
