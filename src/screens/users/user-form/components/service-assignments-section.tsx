import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity, View } from 'react-native';

import { ThemedText } from '@/src/components/themed-text';
import { useAppColors } from '@/src/styles';
import {
  assignmentKey,
  needsDepartment,
} from '@/src/screens/users/user-form/user-form.mapper';
import type { UserFormActions, UserFormState } from '@/src/screens/users/user-form/user-form.types';
import { Field } from '@/src/screens/users/user-form/components/form-controls';
import { createUserFormStyles } from '@/src/screens/users/user-form/components/user-form.styles';
import {
  USER_SERVICE_DEPARTMENTS,
  USER_SERVICE_DEPARTMENT_LABELS,
  USER_SERVICE_POSITION_LABELS,
} from '@/src/types/user';

export function ServiceAssignmentsSection({
  state,
  actions,
}: {
  state: UserFormState;
  actions: UserFormActions;
}) {
  const colors = useAppColors();
  const styles = createUserFormStyles(colors);

  const addButtonDisabled =
    !state.selectedDraftAssignment ||
    !state.canEdit ||
    actions.isDraftAssignmentUnavailable(state.selectedDraftAssignment);

  const addButton = (
    <TouchableOpacity
      style={[
        styles.addAssignmentButton,
        addButtonDisabled && styles.addAssignmentButtonDisabled,
      ]}
      onPress={actions.addServiceAssignment}
      disabled={addButtonDisabled}
      activeOpacity={0.8}
    >
      <Ionicons name="add-outline" size={16} color={colors.primary} />
      <ThemedText style={styles.addAssignmentText}>Agregar funcion</ThemedText>
    </TouchableOpacity>
  );

  return (
    <>
      <Field label="Asignacion de servicio" error={state.errors.assignment}>
        {state.serviceAssignments.length > 0 ? (
          <View style={styles.assignmentList}>
            {state.serviceAssignments.map((assignment) => (
              <View key={assignmentKey(assignment)} style={styles.assignmentPill}>
                <ThemedText style={styles.assignmentPillText}>{assignment.label}</ThemedText>
                <TouchableOpacity
                  style={styles.assignmentRemove}
                  onPress={() => actions.removeServiceAssignment(assignment)}
                  disabled={!state.isAdmin}
                >
                  <Ionicons name="close-outline" size={14} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ) : (
          <ThemedText style={styles.hintText}>Sin funciones congregacionales registradas.</ThemedText>
        )}

        <View style={styles.departmentRow}>
          {state.positionOptions.map((item) => {
            const disabledByAssignment = actions.isPositionOccupied(item);
            const disabled = !state.isAdmin || disabledByAssignment;

            return (
              <TouchableOpacity
                key={item}
                style={[
                  styles.departmentChip,
                  state.servicePositionDraft === item && styles.departmentChipActive,
                  disabledByAssignment && styles.departmentChipDisabled,
                ]}
                onPress={() => {
                  if (disabled) return;
                  actions.setServicePositionDraft(item);
                }}
                activeOpacity={0.8}
                disabled={disabled}
              >
                <ThemedText
                  style={[
                    styles.departmentChipText,
                    state.servicePositionDraft === item && styles.departmentChipTextActive,
                    disabledByAssignment && styles.departmentChipTextDisabled,
                  ]}
                >
                  {item === 'none' ? 'Sin asignacion' : USER_SERVICE_POSITION_LABELS[item]}
                </ThemedText>
              </TouchableOpacity>
            );
          })}
        </View>
      </Field>

      {needsDepartment(state.servicePositionDraft) ? (
        <Field label="Departamento" error={state.errors.assignment}>
          <View style={styles.departmentRow}>
            {USER_SERVICE_DEPARTMENTS.map((item) => {
              const disabledByAssignment = actions.isDepartmentOccupied(item);
              const disabled = !state.isAdmin || disabledByAssignment;

              return (
                <TouchableOpacity
                  key={item}
                  style={[
                    styles.departmentChip,
                    state.serviceDepartmentDraft === item && styles.departmentChipActive,
                    disabledByAssignment && styles.departmentChipDisabled,
                  ]}
                  onPress={() => {
                    if (disabled) return;
                    actions.setServiceDepartmentDraft(item);
                  }}
                  activeOpacity={0.8}
                  disabled={disabled}
                >
                  <ThemedText
                    style={[
                      styles.departmentChipText,
                      state.serviceDepartmentDraft === item && styles.departmentChipTextActive,
                      disabledByAssignment && styles.departmentChipTextDisabled,
                    ]}
                  >
                    {USER_SERVICE_DEPARTMENT_LABELS[item]}
                  </ThemedText>
                </TouchableOpacity>
              );
            })}
          </View>
          {addButton}
        </Field>
      ) : state.servicePositionDraft !== 'none' ? (
        addButton
      ) : null}
    </>
  );
}
