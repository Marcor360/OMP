import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { LoadingState } from '@/src/components/common/LoadingState';
import { PageHeader } from '@/src/components/layout/PageHeader';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { ThemedText } from '@/src/components/themed-text';
import { AppColors } from '@/src/constants/app-colors';
import { useUser } from '@/src/context/user-context';
import {
  createUserByAdmin,
  updateUserByAdmin,
} from '@/src/services/users/admin-users-service';
import { getUserById } from '@/src/services/users/users-service';
import { ROLE_LABELS, UpdateUserDTO, UserRole } from '@/src/types/user';
import { formatFirestoreError } from '@/src/utils/errors/errors';
import { hasErrors, validateEmail, validateRequired } from '@/src/utils/validation/validation';

type Mode = 'create' | 'edit';

interface FormErrors {
  displayName?: string;
  email?: string;
}

export function UserFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const mode: Mode = id ? 'edit' : 'create';

  const {
    congregationId,
    isAdmin,
    loadingProfile,
    profileError,
  } = useUser();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('user');
  const [phone, setPhone] = useState('');
  const [department, setDepartment] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(mode === 'edit');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (mode !== 'edit') {
      setLoading(false);
      return;
    }

    if (!id || loadingProfile || !congregationId) return;

    getUserById(id)
      .then((loadedUser) => {
        if (!loadedUser) {
          Alert.alert('Error', 'Usuario no encontrado.');
          router.back();
          return;
        }

        if (loadedUser.congregationId !== congregationId) {
          Alert.alert('Error', 'No tienes permisos para editar este usuario.');
          router.back();
          return;
        }

        setDisplayName(loadedUser.displayName);
        setEmail(loadedUser.email);
        setRole(loadedUser.role);
        setPhone(loadedUser.phone ?? '');
        setDepartment(loadedUser.department ?? '');
      })
      .catch((requestError) => {
        Alert.alert('Error', formatFirestoreError(requestError));
        router.back();
      })
      .finally(() => setLoading(false));
  }, [congregationId, id, loadingProfile, mode, router]);

  const validate = (): boolean => {
    const nextErrors: FormErrors = {
      displayName: validateRequired(displayName, 'El nombre'),
      email: mode === 'create' ? validateEmail(email) : undefined,
    };

    setErrors(nextErrors);
    return !hasErrors(nextErrors as Record<string, string | undefined>);
  };

  const handleSave = async () => {
    if (!isAdmin) {
      Alert.alert('Permisos insuficientes', 'Solo administradores pueden crear o editar usuarios.');
      return;
    }

    if (!congregationId) {
      Alert.alert('Error', profileError ?? 'No se encontro la congregacion del usuario actual.');
      return;
    }

    if (!validate()) return;

    setSaving(true);

    try {
      if (mode === 'create') {
        await createUserByAdmin({
          email,
          displayName,
          role,
          congregationId,
          phone,
          department,
          isActive: true,
        });

        Alert.alert('Exito', 'Usuario creado correctamente.');
      } else if (id) {
        const payload: UpdateUserDTO = { displayName, role, phone, department };
        await updateUserByAdmin({ uid: id, data: payload });
        Alert.alert('Exito', 'Usuario actualizado correctamente.');
      }

      router.back();
    } catch (requestError) {
      Alert.alert('Error', formatFirestoreError(requestError));
    } finally {
      setSaving(false);
    }
  };

  if (loading || loadingProfile) return <LoadingState />;

  const roles: UserRole[] = ['admin', 'supervisor', 'user'];

  return (
    <ScreenContainer scrollable={false}>
      <PageHeader
        title={mode === 'create' ? 'Nuevo usuario' : 'Editar usuario'}
        showBack
      />
      <ScrollView contentContainerStyle={styles.form}>
        {!isAdmin ? (
          <View style={styles.permissionNotice}>
            <ThemedText style={styles.permissionText}>
              Solo administradores pueden guardar cambios en usuarios.
            </ThemedText>
          </View>
        ) : null}

        <Field label="Nombre completo *" error={errors.displayName}>
          <TextInput
            style={[styles.input, errors.displayName && styles.inputError]}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Ej: Juan Perez"
            placeholderTextColor={AppColors.textDisabled}
            editable={isAdmin}
          />
        </Field>

        {mode === 'create' && (
          <Field label="Correo electronico *" error={errors.email}>
            <TextInput
              style={[styles.input, errors.email && styles.inputError]}
              value={email}
              onChangeText={setEmail}
              placeholder="juan@empresa.com"
              placeholderTextColor={AppColors.textDisabled}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={isAdmin}
            />
          </Field>
        )}

        <Field label="Rol">
          <View style={styles.roleRow}>
            {roles.map((item) => (
              <TouchableOpacity
                key={item}
                style={[styles.roleChip, role === item && styles.roleChipActive]}
                onPress={() => setRole(item)}
                activeOpacity={0.8}
                disabled={!isAdmin}
              >
                <ThemedText style={[styles.roleChipText, role === item && styles.roleChipTextActive]}>
                  {ROLE_LABELS[item]}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </View>
        </Field>

        <Field label="Telefono">
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="10 digitos"
            placeholderTextColor={AppColors.textDisabled}
            keyboardType="phone-pad"
            editable={isAdmin}
          />
        </Field>

        <Field label="Departamento">
          <TextInput
            style={styles.input}
            value={department}
            onChangeText={setDepartment}
            placeholder="Ej: Recursos Humanos"
            placeholderTextColor={AppColors.textDisabled}
            editable={isAdmin}
          />
        </Field>

        <TouchableOpacity
          style={[styles.saveButton, (saving || !isAdmin) && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving || !isAdmin}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
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

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.fieldWrap}>
      <ThemedText style={styles.label}>{label}</ThemedText>
      {children}
      {error ? <ThemedText style={styles.errorText}>{error}</ThemedText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    padding: 16,
    gap: 20,
    paddingBottom: 32,
  },
  fieldWrap: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: AppColors.textSecondary,
  },
  input: {
    backgroundColor: AppColors.surface,
    borderWidth: 1,
    borderColor: AppColors.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: AppColors.textPrimary,
  },
  inputError: {
    borderColor: AppColors.error,
  },
  errorText: {
    color: AppColors.error,
    fontSize: 12,
  },
  roleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  roleChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: AppColors.border,
    backgroundColor: AppColors.surface,
    alignItems: 'center',
  },
  roleChipActive: {
    backgroundColor: AppColors.primary,
    borderColor: AppColors.primary,
  },
  roleChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: AppColors.textMuted,
  },
  roleChipTextActive: {
    color: '#fff',
  },
  saveButton: {
    backgroundColor: AppColors.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  permissionNotice: {
    borderWidth: 1,
    borderColor: AppColors.warning + '66',
    backgroundColor: AppColors.warning + '20',
    borderRadius: 10,
    padding: 12,
  },
  permissionText: {
    fontSize: 13,
    color: AppColors.warning,
    fontWeight: '600',
  },
});