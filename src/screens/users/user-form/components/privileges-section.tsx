import { View } from 'react-native';

import { ThemedText } from '@/src/components/themed-text';
import type { UserFormActions, UserFormState } from '@/src/screens/users/user-form/user-form.types';
import { Field, ToggleChip } from '@/src/screens/users/user-form/components/form-controls';
import { createUserFormStyles } from '@/src/screens/users/user-form/components/user-form.styles';
import { useAppColors } from '@/src/styles';
import { PRIVILEGE_LABELS } from '@/src/types/user';

export function PrivilegesSection({
  state,
  actions,
}: {
  state: UserFormState;
  actions: UserFormActions;
}) {
  const colors = useAppColors();
  const styles = createUserFormStyles(colors);

  return (
    <Field label="Privilegios / nombramientos" error={state.errors.privileges}>
      <ThemedText style={styles.hintText}>
        Selecciona los privilegios o nombramientos del usuario. Estos no dependen del rol de acceso al sistema.
      </ThemedText>
      <View style={styles.departmentRow}>
        <ToggleChip
          label={PRIVILEGE_LABELS.isElder}
          selected={Boolean(state.privileges.isElder)}
          disabled={!state.isAdmin || state.requiresAdminElder}
          onPress={() => actions.togglePrivilege('isElder')}
        />
        <ToggleChip
          label={PRIVILEGE_LABELS.isMinisterialServant}
          selected={Boolean(state.privileges.isMinisterialServant)}
          disabled={!state.isAdmin || state.requiresAdminElder}
          onPress={() => actions.togglePrivilege('isMinisterialServant')}
        />
        <ToggleChip
          label={PRIVILEGE_LABELS.isRegularPioneer}
          selected={Boolean(state.privileges.isRegularPioneer)}
          disabled={!state.isAdmin}
          onPress={() => actions.togglePrivilege('isRegularPioneer')}
        />
        <ToggleChip
          label={PRIVILEGE_LABELS.isAuxiliaryPioneer}
          selected={Boolean(state.privileges.isAuxiliaryPioneer)}
          disabled={!state.isAdmin}
          onPress={() => actions.togglePrivilege('isAuxiliaryPioneer')}
        />
      </View>
      {state.requiresAdminElder ? (
        <ThemedText style={styles.hintText}>
          Este nombramiento requiere Anciano; Siervo Ministerial no puede combinarse.
        </ThemedText>
      ) : null}
    </Field>
  );
}
