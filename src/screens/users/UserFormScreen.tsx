import React, { useEffect, useMemo, useState } from 'react';
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
import { Ionicons } from '@expo/vector-icons';

import { LoadingState } from '@/src/components/common/LoadingState';
import { PageHeader } from '@/src/components/layout/PageHeader';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { ThemedText } from '@/src/components/themed-text';
import { useUser } from '@/src/context/user-context';
import { getCongregationEmailDomain } from '@/src/services/congregations/congregations-service';
import {
  createUserByAdmin,
  updateUserByAdmin,
  updateUserPasswordByAdmin,
} from '@/src/services/users/admin-users-service';
import { getAllUsers, getUserById } from '@/src/services/users/users-service';
import { type AppColors as AppColorSet, useAppColors } from '@/src/styles';
import {
  type AppUser,
  ROLE_LABELS,
  USER_SERVICE_DEPARTMENTS,
  USER_SERVICE_DEPARTMENT_LABELS,
  USER_SERVICE_POSITION_LABELS,
  UpdateUserDTO,
  UserServiceDepartment,
  UserServicePosition,
  UserRole,
} from '@/src/types/user';
import { formatFirestoreError } from '@/src/utils/errors/errors';
import { hasErrors, validateMinLength, validateRequired } from '@/src/utils/validation/validation';

type Mode = 'create' | 'edit';
type ServiceSelection = UserServicePosition | 'none';

interface FormErrors {
  displayName?: string;
  firstName?: string;
  lastName?: string;
  password?: string;
  newPassword?: string;
  assignment?: string;
}

const DEPARTMENT_LABEL_TO_KEY: Record<string, UserServiceDepartment> = Object.fromEntries(
  Object.entries(USER_SERVICE_DEPARTMENT_LABELS).map(([key, label]) => [label, key as UserServiceDepartment])
) as Record<string, UserServiceDepartment>;

const normalizeNameForEmail = (value: string): string => {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
};

const buildGeneratedEmailPreview = (
  firstName: string,
  middleName: string,
  lastName: string,
  domain: string
): string => {
  const primary = `${normalizeNameForEmail(firstName)}${normalizeNameForEmail(lastName)}`;
  const fallback =
    `${normalizeNameForEmail(firstName)}${normalizeNameForEmail(middleName)}${normalizeNameForEmail(lastName)}` ||
    'usuario';
  return `${(primary || fallback)}@${domain.toLowerCase()}`;
};

const parseLegacyAssignment = (
  value: string | undefined
): { position: ServiceSelection; department: UserServiceDepartment | '' } => {
  if (!value) return { position: 'none', department: '' };
  if (value === 'Coordinador') return { position: 'coordinador', department: '' };
  if (value === 'Secretario') return { position: 'secretario', department: '' };
  if (value.startsWith('Encargado de ')) {
    const label = value.replace('Encargado de ', '').trim();
    return { position: 'encargado', department: DEPARTMENT_LABEL_TO_KEY[label] ?? '' };
  }
  if (value.startsWith('Auxiliar de ')) {
    const label = value.replace('Auxiliar de ', '').trim();
    return { position: 'auxiliar', department: DEPARTMENT_LABEL_TO_KEY[label] ?? '' };
  }
  return { position: 'none', department: '' };
};

const needsDepartment = (position: ServiceSelection): boolean =>
  position === 'encargado' || position === 'auxiliar';

const buildDepartmentLabel = (
  position: ServiceSelection,
  department: UserServiceDepartment | ''
): string | undefined => {
  if (position === 'coordinador') return 'Coordinador';
  if (position === 'secretario') return 'Secretario';
  if (position === 'encargado' && department) {
    return `Encargado de ${USER_SERVICE_DEPARTMENT_LABELS[department]}`;
  }
  if (position === 'auxiliar' && department) {
    return `Auxiliar de ${USER_SERVICE_DEPARTMENT_LABELS[department]}`;
  }
  return undefined;
};

const resolveServiceAssignmentFromUser = (
  user: Pick<AppUser, 'servicePosition' | 'serviceDepartment' | 'department'>
): { position: ServiceSelection; department: UserServiceDepartment | '' } => {
  if (user.servicePosition) {
    if (
      (user.servicePosition === 'encargado' || user.servicePosition === 'auxiliar') &&
      !user.serviceDepartment
    ) {
      const legacy = parseLegacyAssignment(user.department);
      return {
        position: user.servicePosition,
        department: legacy.department,
      };
    }

    return {
      position: user.servicePosition,
      department: user.serviceDepartment ?? '',
    };
  }

  return parseLegacyAssignment(user.department);
};

export function UserFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const mode: Mode = id ? 'edit' : 'create';
  const colors = useAppColors();
  const styles = createStyles(colors);

  const { congregationId, isAdmin, loadingProfile, profileError } = useUser();

  const [displayName, setDisplayName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [secondLastName, setSecondLastName] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [role, setRole] = useState<UserRole>('user');
  const [phone, setPhone] = useState('');
  const [activeUsers, setActiveUsers] = useState<AppUser[]>([]);
  const [servicePosition, setServicePosition] = useState<ServiceSelection>('none');
  const [serviceDepartment, setServiceDepartment] = useState<UserServiceDepartment | ''>('');
  const [allowedEmailDomain, setAllowedEmailDomain] = useState('congregacion.com');
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(mode === 'edit');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!congregationId) return;

    getCongregationEmailDomain(congregationId)
      .then((domain) => setAllowedEmailDomain(domain))
      .catch(() => setAllowedEmailDomain('congregacion.com'));
  }, [congregationId]);

  useEffect(() => {
    if (!congregationId) {
      setActiveUsers([]);
      return;
    }

    let cancelled = false;

    getAllUsers(congregationId)
      .then((users) => {
        if (cancelled) return;
        setActiveUsers(users.filter((user) => user.isActive));
      })
      .catch(() => {
        if (cancelled) return;
        setActiveUsers([]);
      });

    return () => {
      cancelled = true;
    };
  }, [congregationId]);

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
        setRole(loadedUser.role);
        setPhone(loadedUser.phone ?? '');

        if (loadedUser.servicePosition) {
          setServicePosition(loadedUser.servicePosition);
          setServiceDepartment(loadedUser.serviceDepartment ?? '');
        } else {
          const legacy = parseLegacyAssignment(loadedUser.department);
          setServicePosition(legacy.position);
          setServiceDepartment(legacy.department);
        }
      })
      .catch((requestError) => {
        Alert.alert('Error', formatFirestoreError(requestError));
        router.back();
      })
      .finally(() => setLoading(false));
  }, [congregationId, id, loadingProfile, mode, router]);

  const generatedEmailPreview = useMemo(
    () => buildGeneratedEmailPreview(firstName, middleName, lastName, allowedEmailDomain),
    [allowedEmailDomain, firstName, middleName, lastName]
  );

  const positionOptions = useMemo<ServiceSelection[]>(
    () =>
      role === 'admin'
        ? ['none', 'coordinador', 'secretario', 'encargado', 'auxiliar']
        : ['none', 'encargado', 'auxiliar'],
    [role]
  );

  const occupiedAssignments = useMemo(() => {
    const occupiedUniquePositions = new Set<UserServicePosition>();
    const occupiedEncargadoDepartments = new Set<UserServiceDepartment>();

    activeUsers.forEach((user) => {
      if (id && user.uid === id) return;

      const assignment = resolveServiceAssignmentFromUser(user);

      if (
        assignment.position === 'coordinador' ||
        assignment.position === 'secretario'
      ) {
        occupiedUniquePositions.add(assignment.position);
      }

      if (assignment.position === 'encargado' && assignment.department) {
        occupiedEncargadoDepartments.add(assignment.department);
      }
    });

    return {
      occupiedUniquePositions,
      occupiedEncargadoDepartments,
    };
  }, [activeUsers, id]);

  const isPositionOccupied = (position: ServiceSelection): boolean => {
    if (position === 'none' || position === 'auxiliar') return false;

    if (position === 'coordinador' || position === 'secretario') {
      return occupiedAssignments.occupiedUniquePositions.has(position);
    }

    if (position === 'encargado') {
      return USER_SERVICE_DEPARTMENTS.every((department) =>
        occupiedAssignments.occupiedEncargadoDepartments.has(department)
      );
    }

    return false;
  };

  const isDepartmentOccupied = (department: UserServiceDepartment): boolean => {
    if (servicePosition !== 'encargado') return false;
    return occupiedAssignments.occupiedEncargadoDepartments.has(department);
  };

  useEffect(() => {
    if (!positionOptions.includes(servicePosition)) {
      setServicePosition('none');
      setServiceDepartment('');
      return;
    }

    if (!needsDepartment(servicePosition) && serviceDepartment) {
      setServiceDepartment('');
    }
  }, [positionOptions, serviceDepartment, servicePosition]);

  useEffect(() => {
    if (
      (servicePosition === 'coordinador' || servicePosition === 'secretario') &&
      occupiedAssignments.occupiedUniquePositions.has(servicePosition)
    ) {
      setServicePosition('none');
    }
  }, [occupiedAssignments.occupiedUniquePositions, servicePosition]);

  useEffect(() => {
    if (servicePosition !== 'encargado' || !serviceDepartment) return;

    if (occupiedAssignments.occupiedEncargadoDepartments.has(serviceDepartment)) {
      setServiceDepartment('');
    }
  }, [
    occupiedAssignments.occupiedEncargadoDepartments,
    serviceDepartment,
    servicePosition,
  ]);

  const validate = (): boolean => {
    const assignmentError = needsDepartment(servicePosition)
      ? validateRequired(serviceDepartment, 'El departamento')
      : undefined;

    const nextErrors: FormErrors =
      mode === 'create'
        ? {
            firstName: validateRequired(firstName, 'El primer nombre'),
            lastName: validateRequired(lastName, 'El apellido paterno'),
            password:
              validateRequired(password, 'La contrasena') ??
              validateMinLength(password, 6, 'La contrasena'),
            assignment: assignmentError,
          }
        : {
            displayName: validateRequired(displayName, 'El nombre'),
            newPassword:
              newPassword.trim().length > 0
                ? validateMinLength(newPassword, 6, 'La nueva contrasena')
                : undefined,
            assignment: assignmentError,
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
      const normalizedMiddle = middleName.trim() || undefined;
      const normalizedServicePosition =
        servicePosition === 'none' ? undefined : servicePosition;
      const normalizedServiceDepartment = needsDepartment(servicePosition)
        ? serviceDepartment || undefined
        : undefined;
      const departmentLabel = buildDepartmentLabel(servicePosition, serviceDepartment);

      if (mode === 'create') {
        const createdUser = await createUserByAdmin({
          firstName,
          middleName: normalizedMiddle,
          lastName,
          secondLastName: secondLastName.trim() || undefined,
          password,
          displayName: [firstName, normalizedMiddle, lastName, secondLastName.trim()].filter(Boolean).join(' ').trim(),
          email: generatedEmailPreview,
          role,
          congregationId,
          phone,
          department: departmentLabel,
          servicePosition: normalizedServicePosition,
          serviceDepartment: normalizedServiceDepartment,
          isActive: true,
        });

        Alert.alert(
          'Usuario creado',
          `Correo asignado: ${createdUser.email ?? generatedEmailPreview}\nDominio: @${createdUser.requiredDomain ?? allowedEmailDomain}`
        );
      } else if (id) {
        const payload: UpdateUserDTO = {
          displayName,
          role,
          phone,
          department: departmentLabel,
          servicePosition: normalizedServicePosition,
          serviceDepartment: normalizedServiceDepartment,
        };

        await updateUserByAdmin({ uid: id, data: payload });

        if (newPassword.trim().length > 0) {
          await updateUserPasswordByAdmin({
            uid: id,
            newPassword: newPassword.trim(),
          });
        }

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
    <ScreenContainer scrollable={false} padded={false}>
      <PageHeader title={mode === 'create' ? 'Nuevo usuario' : 'Editar usuario'} showBack />
      <ScrollView
        contentContainerStyle={styles.form}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {!isAdmin ? (
          <View style={styles.permissionNotice}>
            <ThemedText style={styles.permissionText}>
              Solo administradores pueden guardar cambios en usuarios.
            </ThemedText>
          </View>
        ) : null}

        {mode === 'create' ? (
          <>
            <Field label="Primer nombre *" error={errors.firstName}>
              <TextInput
                style={[styles.input, errors.firstName && styles.inputError]}
                value={firstName}
                onChangeText={setFirstName}
                placeholder="Ej: Juan"
                placeholderTextColor={colors.textDisabled}
                editable={isAdmin}
              />
            </Field>

            <Field label="Segundo nombre">
              <TextInput
                style={styles.input}
                value={middleName}
                onChangeText={setMiddleName}
                placeholder="Ej: Carlos"
                placeholderTextColor={colors.textDisabled}
                editable={isAdmin}
              />
            </Field>

            <Field label="Apellido paterno *" error={errors.lastName}>
              <TextInput
                style={[styles.input, errors.lastName && styles.inputError]}
                value={lastName}
                onChangeText={setLastName}
                placeholder="Ej: Perez"
                placeholderTextColor={colors.textDisabled}
                editable={isAdmin}
              />
            </Field>

            <Field label="Apellido materno">
              <TextInput
                style={styles.input}
                value={secondLastName}
                onChangeText={setSecondLastName}
                placeholder="Ej: Silva"
                placeholderTextColor={colors.textDisabled}
                editable={isAdmin}
              />
            </Field>

            <Field label="Contrasena inicial *" error={errors.password}>
              <PasswordInput
                value={password}
                onChangeText={setPassword}
                placeholder="Minimo 6 caracteres"
                visible={showPassword}
                onToggleVisibility={() => setShowPassword((value) => !value)}
                hasError={Boolean(errors.password)}
                editable={isAdmin}
              />
            </Field>

            <Field label="Correo generado automaticamente">
              <TextInput style={styles.inputReadOnly} value={generatedEmailPreview} editable={false} />
              <ThemedText style={styles.hintText}>
                Si ya existe un correo igual, se intentara con primer+segundo+apellido y despues numeracion.
              </ThemedText>
            </Field>
          </>
        ) : (
          <>
            <Field label="Nombre completo *" error={errors.displayName}>
              <TextInput
                style={[styles.input, errors.displayName && styles.inputError]}
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Ej: Juan Perez"
                placeholderTextColor={colors.textDisabled}
                editable={isAdmin}
              />
            </Field>

            <Field label="Nueva contrasena (opcional)" error={errors.newPassword}>
              <PasswordInput
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Dejar vacio para no cambiar"
                visible={showNewPassword}
                onToggleVisibility={() => setShowNewPassword((value) => !value)}
                hasError={Boolean(errors.newPassword)}
                editable={isAdmin}
              />
            </Field>
          </>
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
            placeholderTextColor={colors.textDisabled}
            keyboardType="phone-pad"
            editable={isAdmin}
          />
        </Field>

        <Field label="Asignacion de servicio" error={errors.assignment}>
          <View style={styles.departmentRow}>
            {positionOptions.map((item) => {
              const disabledByAssignment = isPositionOccupied(item);
              const disabled = !isAdmin || disabledByAssignment;

              return (
                <TouchableOpacity
                  key={item}
                  style={[
                    styles.departmentChip,
                    servicePosition === item && styles.departmentChipActive,
                    disabledByAssignment && styles.departmentChipDisabled,
                  ]}
                  onPress={() => {
                    if (disabled) return;
                    setServicePosition(item);
                  }}
                  activeOpacity={0.8}
                  disabled={disabled}
                >
                <ThemedText
                  style={[
                    styles.departmentChipText,
                    servicePosition === item && styles.departmentChipTextActive,
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

        {needsDepartment(servicePosition) ? (
          <Field label="Departamento" error={errors.assignment}>
            <View style={styles.departmentRow}>
              {USER_SERVICE_DEPARTMENTS.map((item) => {
                const disabledByAssignment = isDepartmentOccupied(item);
                const disabled = !isAdmin || disabledByAssignment;

                return (
                  <TouchableOpacity
                    key={item}
                    style={[
                      styles.departmentChip,
                      serviceDepartment === item && styles.departmentChipActive,
                      disabledByAssignment && styles.departmentChipDisabled,
                    ]}
                    onPress={() => {
                      if (disabled) return;
                      setServiceDepartment(item);
                    }}
                    activeOpacity={0.8}
                    disabled={disabled}
                  >
                  <ThemedText
                    style={[
                      styles.departmentChipText,
                      serviceDepartment === item && styles.departmentChipTextActive,
                      disabledByAssignment && styles.departmentChipTextDisabled,
                    ]}
                  >
                    {USER_SERVICE_DEPARTMENT_LABELS[item]}
                  </ThemedText>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Field>
        ) : null}

        <TouchableOpacity
          style={[styles.saveButton, (saving || !isAdmin) && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving || !isAdmin}
          activeOpacity={0.8}
        >
          {saving ? (
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

function PasswordInput({
  value,
  onChangeText,
  placeholder,
  visible,
  onToggleVisibility,
  hasError,
  editable,
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  visible: boolean;
  onToggleVisibility: () => void;
  hasError: boolean;
  editable: boolean;
}) {
  const colors = useAppColors();
  const styles = createStyles(colors);

  return (
    <View style={[styles.passwordWrap, hasError && styles.inputError]}>
      <TextInput
        style={styles.passwordInput}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textDisabled}
        secureTextEntry={!visible}
        autoCapitalize="none"
        editable={editable}
      />
      <TouchableOpacity style={styles.eyeButton} onPress={onToggleVisibility} activeOpacity={0.8}>
        <Ionicons
          name={visible ? 'eye-off-outline' : 'eye-outline'}
          size={18}
          color={colors.textMuted}
        />
      </TouchableOpacity>
    </View>
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
  const colors = useAppColors();
  const styles = createStyles(colors);

  return (
    <View style={styles.fieldWrap}>
      <ThemedText style={styles.label}>{label}</ThemedText>
      {children}
      {error ? <ThemedText style={styles.errorText}>{error}</ThemedText> : null}
    </View>
  );
}

const createStyles = (colors: AppColorSet) =>
  StyleSheet.create({
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
      color: colors.textSecondary,
    },
    input: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      padding: 12,
      fontSize: 15,
      color: colors.textPrimary,
    },
    passwordWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingLeft: 12,
      paddingRight: 8,
    },
    passwordInput: {
      flex: 1,
      paddingVertical: 12,
      fontSize: 15,
      color: colors.textPrimary,
    },
    eyeButton: {
      padding: 6,
    },
    inputReadOnly: {
      backgroundColor: colors.surfaceRaised,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      padding: 12,
      fontSize: 15,
      color: colors.textMuted,
    },
    inputError: {
      borderColor: colors.error,
    },
    errorText: {
      color: colors.error,
      fontSize: 12,
    },
    hintText: {
      color: colors.textMuted,
      fontSize: 12,
    },
    roleRow: {
      flexDirection: 'row',
      gap: 8,
    },
    departmentRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    departmentChip: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 999,
      backgroundColor: colors.surface,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    departmentChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    departmentChipDisabled: {
      opacity: 0.45,
      backgroundColor: colors.surfaceRaised,
    },
    departmentChipText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textMuted,
    },
    departmentChipTextActive: {
      color: colors.onPrimary,
    },
    departmentChipTextDisabled: {
      color: colors.textDisabled,
    },
    roleChip: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: 'center',
    },
    roleChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    roleChipText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textMuted,
    },
    roleChipTextActive: {
      color: colors.onPrimary,
    },
    saveButton: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
      marginTop: 8,
    },
    saveButtonDisabled: {
      opacity: 0.6,
    },
    saveButtonText: {
      color: colors.onPrimary,
      fontWeight: '700',
      fontSize: 16,
    },
    permissionNotice: {
      borderWidth: 1,
      borderColor: colors.warning + '66',
      backgroundColor: colors.warning + '20',
      borderRadius: 10,
      padding: 12,
    },
    permissionText: {
      fontSize: 13,
      color: colors.warning,
      fontWeight: '600',
    },
  });
