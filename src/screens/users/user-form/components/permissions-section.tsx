import { View } from 'react-native';

import { ThemedText } from '@/src/components/themed-text';
import type { UserFormActions, UserFormState } from '@/src/screens/users/user-form/user-form.types';
import { Field, ToggleChip } from '@/src/screens/users/user-form/components/form-controls';
import { createUserFormStyles } from '@/src/screens/users/user-form/components/user-form.styles';
import { useAppColors } from '@/src/styles';
import type { PermissionDepartment } from '@/src/types/user';
import {
  ACTION_LABELS,
  DEPARTMENT_LABELS,
  SUPERVISOR_PERMISSION_TEMPLATE,
  TERRITORY_ACTION_LABELS,
  TERRITORY_PERMISSION_ACTIONS,
} from '@/src/utils/permissions/permissions';

export function PermissionsSection({
  state,
  actions,
}: {
  state: UserFormState;
  actions: UserFormActions;
}) {
  const colors = useAppColors();
  const styles = createUserFormStyles(colors);

  return (
    <>
      {state.role === 'supervisor' ? (
        <Field label="Funciones permitidas para este supervisor">
          <ThemedText style={styles.hintText}>
            Activa solo las acciones que este supervisor podra realizar. Las asignaciones de servicio tambien pueden sumar permisos.
          </ThemedText>
          <View style={styles.permissionGroups}>
            {Object.entries(SUPERVISOR_PERMISSION_TEMPLATE).map(([department, departmentActions]) => (
              <View key={department} style={styles.permissionGroup}>
                <ThemedText style={styles.permissionGroupTitle}>
                  {DEPARTMENT_LABELS[department as PermissionDepartment]}
                </ThemedText>
                <View style={styles.departmentRow}>
                  {departmentActions.map((action) => (
                    <ToggleChip
                      key={`${department}:${action}`}
                      label={ACTION_LABELS[action]}
                      selected={state.permissions[department as PermissionDepartment]?.[action] === true}
                      disabled={!state.isAdmin}
                      onPress={() => actions.togglePermission(department as PermissionDepartment, action)}
                    />
                  ))}
                </View>
                {department === 'predicacion' ? (
                  <View style={styles.departmentRow}>
                    {TERRITORY_PERMISSION_ACTIONS.map((action) => (
                      <ToggleChip
                        key={`predicacion:territories:${action}`}
                        label={TERRITORY_ACTION_LABELS[action]}
                        selected={state.permissions.predicacion?.territories?.[action] === true}
                        disabled={!state.isAdmin}
                        onPress={() => actions.toggleTerritoryPermission(action)}
                      />
                    ))}
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        </Field>
      ) : null}

      <Field label="Permisos asignados">
        {state.allowedPermissionLabels.length > 0 ? (
          <View style={styles.permissionSummary}>
            {state.allowedPermissionLabels.map((item) => (
              <ThemedText key={item} style={styles.permissionSummaryText}>
                {item}
              </ThemedText>
            ))}
          </View>
        ) : (
          <ThemedText style={styles.hintText}>Sin permisos adicionales registrados.</ThemedText>
        )}
      </Field>
    </>
  );
}
