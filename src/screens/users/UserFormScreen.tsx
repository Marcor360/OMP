import React from 'react';
import {
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  View,
} from 'react-native';

import { LoadingState } from '@/src/components/common/LoadingState';
import { PageHeader } from '@/src/components/layout/PageHeader';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { ThemedText } from '@/src/components/themed-text';
import { useAppColors } from '@/src/styles';
import { PersonalDataSection } from '@/src/screens/users/user-form/components/personal-data-section';
import { PermissionsSection } from '@/src/screens/users/user-form/components/permissions-section';
import { PrivilegesSection } from '@/src/screens/users/user-form/components/privileges-section';
import { RolePositionSection } from '@/src/screens/users/user-form/components/role-position-section';
import { ServiceAssignmentsSection } from '@/src/screens/users/user-form/components/service-assignments-section';
import { createUserFormStyles } from '@/src/screens/users/user-form/components/user-form.styles';
import { useUserForm } from '@/src/screens/users/user-form/use-user-form';

export function UserFormScreen() {
  const colors = useAppColors();
  const styles = createUserFormStyles(colors);
  const { mode, state, actions } = useUserForm();

  if (state.loading || state.loadingProfile) return <LoadingState />;

  return (
    <ScreenContainer scrollable={false} padded={false}>
      <PageHeader title={mode === 'create' ? 'Nuevo usuario' : 'Editar usuario'} showBack />
      <ScrollView
        contentContainerStyle={styles.form}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {!state.canEdit ? (
          <View style={styles.permissionNotice}>
            <ThemedText style={styles.permissionText}>
              Necesitas permiso para crear o editar usuarios.
            </ThemedText>
          </View>
        ) : null}

        {mode === 'create' && state.planUsage ? (
          <View style={styles.planNotice}>
            <ThemedText style={styles.planTitle}>{state.planUsage.planLabel}</ThemedText>
            <ThemedText style={styles.hintText}>
              Active users: {state.planUsage.activeUsersCount}/{state.planUsage.activeUsersLimit}. Available: {state.planUsage.remainingActiveUsers}.
            </ThemedText>
          </View>
        ) : null}

        <PersonalDataSection mode={mode} state={state} actions={actions} />
        <RolePositionSection state={state} actions={actions} />
        <ServiceAssignmentsSection state={state} actions={actions} />
        <PermissionsSection state={state} actions={actions} />
        <PrivilegesSection state={state} actions={actions} />

        <TouchableOpacity
          style={[styles.saveButton, (state.saving || !state.canEdit) && styles.saveButtonDisabled]}
          onPress={actions.handleSave}
          disabled={state.saving || !state.canEdit}
          activeOpacity={0.8}
        >
          {state.saving ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <ThemedText style={styles.saveButtonText}>
              {mode === 'create' ? 'Crear usuario' : 'Guardar cambios'}
            </ThemedText>
          )}
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  );
}
