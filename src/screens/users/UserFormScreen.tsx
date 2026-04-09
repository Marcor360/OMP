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
import { PageHeader } from '@/src/components/layout/PageHeader';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { LoadingState } from '@/src/components/common/LoadingState';
import { ThemedText } from '@/src/components/themed-text';
import { AppColors } from '@/src/constants/app-colors';
import { getUserById, createUserProfile, updateUser } from '@/src/services/users/users-service';
import { AppUser, CreateUserDTO, UpdateUserDTO, UserRole, ROLE_LABELS } from '@/src/types/user';
import { validateRequired, validateEmail, hasErrors } from '@/src/utils/validation/validation';
import { formatFirestoreError } from '@/src/utils/errors/errors';

type Mode = 'create' | 'edit';

interface FormErrors {
  displayName?: string;
  email?: string;
}

export function UserFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const mode: Mode = id ? 'edit' : 'create';

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('user');
  const [phone, setPhone] = useState('');
  const [department, setDepartment] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(mode === 'edit');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (mode === 'edit' && id) {
      getUserById(id)
        .then((u) => {
          if (u) {
            setDisplayName(u.displayName);
            setEmail(u.email);
            setRole(u.role);
            setPhone(u.phone ?? '');
            setDepartment(u.department ?? '');
          }
        })
        .finally(() => setLoading(false));
    }
  }, [id, mode]);

  const validate = (): boolean => {
    const newErrors: FormErrors = {
      displayName: validateRequired(displayName, 'El nombre'),
      email: mode === 'create' ? validateEmail(email) : undefined,
    };
    setErrors(newErrors);
    return !hasErrors(newErrors);
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      if (mode === 'create') {
        // En producción, aquí llamarías a una Cloud Function para crear el usuario en Auth
        // Por ahora, crea solo el perfil en Firestore con uid generado
        const tempUid = `user_${Date.now()}`;
        await createUserProfile(tempUid, { email, displayName, role, phone, department });
        Alert.alert('Éxito', 'Usuario creado correctamente.');
      } else if (id) {
        const data: UpdateUserDTO = { displayName, role, phone, department };
        await updateUser(id, data);
        Alert.alert('Éxito', 'Usuario actualizado correctamente.');
      }
      router.back();
    } catch (e) {
      Alert.alert('Error', formatFirestoreError(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState />;

  const roles: UserRole[] = ['admin', 'supervisor', 'user'];

  return (
    <ScreenContainer scrollable={false}>
      <PageHeader
        title={mode === 'create' ? 'Nuevo usuario' : 'Editar usuario'}
        showBack
      />
      <ScrollView contentContainerStyle={styles.form}>
        <Field label="Nombre completo *" error={errors.displayName}>
          <TextInput
            style={[styles.input, errors.displayName && styles.inputError]}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Ej: Juan Pérez"
            placeholderTextColor={AppColors.textDisabled}
          />
        </Field>

        {mode === 'create' && (
          <Field label="Correo electrónico *" error={errors.email}>
            <TextInput
              style={[styles.input, errors.email && styles.inputError]}
              value={email}
              onChangeText={setEmail}
              placeholder="juan@empresa.com"
              placeholderTextColor={AppColors.textDisabled}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </Field>
        )}

        <Field label="Rol">
          <View style={styles.roleRow}>
            {roles.map((r) => (
              <TouchableOpacity
                key={r}
                style={[styles.roleChip, role === r && styles.roleChipActive]}
                onPress={() => setRole(r)}
                activeOpacity={0.8}
              >
                <ThemedText
                  style={[styles.roleChipText, role === r && styles.roleChipTextActive]}
                >
                  {ROLE_LABELS[r]}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </View>
        </Field>

        <Field label="Teléfono">
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="10 dígitos"
            placeholderTextColor={AppColors.textDisabled}
            keyboardType="phone-pad"
          />
        </Field>

        <Field label="Departamento">
          <TextInput
            style={styles.input}
            value={department}
            onChangeText={setDepartment}
            placeholder="Ej: Recursos Humanos"
            placeholderTextColor={AppColors.textDisabled}
          />
        </Field>

        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
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
});
