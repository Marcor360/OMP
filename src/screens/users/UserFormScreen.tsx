import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { LoadingState } from '@/src/components/common/LoadingState';
import { PageHeader } from '@/src/components/layout/PageHeader';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { ThemedText } from '@/src/components/themed-text';
import { useUser } from '@/src/context/user-context';
import {
  getCongregationEmailDomain,
  getCongregationPlanUsage,
} from '@/src/services/congregations/congregations-service';
import {
  createUserByAdmin,
  updateUserByAdmin,
  updateUserPasswordByAdmin,
} from '@/src/services/users/admin-users-service';
import { getAllUsers, getUserById } from '@/src/services/users/users-service';
import { type AppColors as AppColorSet, useAppColors } from '@/src/styles';
import { CongregationPlanUsage } from '@/src/types/congregation-plan';
import {
  type AppUser,
  PRIVILEGE_LABELS,
  ROLE_LABELS,
  USER_SERVICE_DEPARTMENTS,
  USER_SERVICE_DEPARTMENT_LABELS,
  USER_SERVICE_POSITION_LABELS,
  UpdateUserDTO,
  UserGender,
  UserPrivileges,
  UserResponsibilities,
  UserRole,
  UserServiceAssignment,
  UserServiceDepartment,
  UserServicePosition,
} from '@/src/types/user';
import { copyToClipboard } from '@/src/utils/clipboard/clipboard';
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
  gender?: string;
  assignment?: string;
  privileges?: string;
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
  if (value === 'Coordinador' || value === 'Coordinator') return { position: 'coordinador', department: '' };
  if (value === 'Secretario' || value === 'Secretary') return { position: 'secretario', department: '' };
  if (value.startsWith('Encargado de ') || value.startsWith('Overseer of ')) {
    const label = value.replace('Encargado de ', '').replace('Overseer of ', '').trim();
    return { position: 'encargado', department: DEPARTMENT_LABEL_TO_KEY[label] ?? '' };
  }
  if (value.startsWith('Auxiliar de ') || value.startsWith('Assistant of ')) {
    const label = value.replace('Auxiliar de ', '').replace('Assistant of ', '').trim();
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
  user: Pick<AppUser, 'servicePosition' | 'serviceDepartment' | 'department' | 'serviceAssignments'>
): UserServiceAssignment[] => {
  const assignments = user.serviceAssignments ?? [];
  if (assignments.length > 0) return assignments;

  const legacy = user.servicePosition
    ? {
      position: user.servicePosition,
      department:
        user.serviceDepartment ??
        (
          user.servicePosition === 'encargado' || user.servicePosition === 'auxiliar'
            ? parseLegacyAssignment(user.department).department || undefined
            : undefined
        ),
    }
    : parseLegacyAssignment(user.department);
  const label = buildDepartmentLabel(legacy.position ?? 'none', legacy.department ?? '');
  return legacy.position && legacy.position !== 'none' && label
    ? [{ position: legacy.position, department: legacy.department || undefined, label }]
    : [];
};

const assignmentKey = (assignment: Pick<UserServiceAssignment, 'position' | 'department'>): string =>
  `${assignment.position}:${assignment.department ?? ''}`;

const GENDER_LABELS: Record<UserGender, string> = {
  masculino: 'Masculino',
  femenino: 'Femenino',
};

const genderOptions: UserGender[] = ['masculino', 'femenino'];

export function UserFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const mode: Mode = id ? 'edit' : 'create';
  const colors = useAppColors();
  const styles = createStyles(colors);

  const { congregationId, isAdmin, isElder, loadingProfile, profileError } = useUser();
  // Los ancianos pueden EDITAR usuarios existentes, pero NO crear nuevos.
  const canEdit = isAdmin || (isElder && mode === 'edit');

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
  const [gender, setGender] = useState<UserGender | null>(null);
  const [phone, setPhone] = useState('');
  const [activeUsers, setActiveUsers] = useState<AppUser[]>([]);
  const [servicePositionDraft, setServicePositionDraft] = useState<ServiceSelection>('none');
  const [serviceDepartmentDraft, setServiceDepartmentDraft] = useState<UserServiceDepartment | ''>('');
  const [serviceAssignments, setServiceAssignments] = useState<UserServiceAssignment[]>([]);
  const [privileges, setPrivileges] = useState<UserPrivileges>({});
  const [responsibilities, setResponsibilities] = useState<UserResponsibilities>({});
  const [allowedEmailDomain, setAllowedEmailDomain] = useState('congregacion.com');
  const [planUsage, setPlanUsage] = useState<CongregationPlanUsage | null>(null);
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
    if (!congregationId || !isAdmin) {
      setPlanUsage(null);
      return;
    }

    let cancelled = false;
    getCongregationPlanUsage(congregationId, { forceServer: true })
      .then((usage) => {
        if (!cancelled) setPlanUsage(usage);
      })
      .catch(() => {
        if (!cancelled) setPlanUsage(null);
      });

    return () => {
      cancelled = true;
    };
  }, [congregationId, isAdmin]);

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
        setGender(loadedUser.gender ?? null);
        setPhone(loadedUser.phone ?? '');

        setServiceAssignments(resolveServiceAssignmentFromUser(loadedUser));

        setPrivileges(loadedUser.privileges ?? {});
        setResponsibilities(loadedUser.responsibilities ?? {});
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

  const handleCopyValue = async (label: string, value: string) => {
    if (!value.trim()) {
      Alert.alert('Sin datos', `No hay ${label.toLowerCase()} para copiar.`);
      return;
    }

    try {
      await copyToClipboard(value);
      Alert.alert('Copiado', `${label} copiado al portapapeles.`);
    } catch {
      Alert.alert('No se pudo copiar', 'Intenta seleccionar el texto manualmente.');
    }
  };

  const positionOptions = useMemo<ServiceSelection[]>(
    () =>
      role === 'admin'
        ? ['none', 'coordinador', 'secretario', 'encargado', 'auxiliar']
        : ['none', 'encargado', 'auxiliar'],
    [role]
  );

  const occupiedAssignments = useMemo(() => {
    const occupiedUniquePositions = new Set<UserServicePosition>();

    activeUsers.forEach((user) => {
      if (id && user.uid === id) return;

      resolveServiceAssignmentFromUser(user).forEach((assignment) => {
        if (
          assignment.position === 'coordinador' ||
          assignment.position === 'secretario'
        ) {
          occupiedUniquePositions.add(assignment.position);
        }
      });
    });

    return {
      occupiedUniquePositions,
    };
  }, [activeUsers, id]);

  const isPositionOccupied = (position: ServiceSelection): boolean => {
    if (position === 'none' || position === 'auxiliar') return false;

    if (position === 'coordinador' || position === 'secretario') {
      return occupiedAssignments.occupiedUniquePositions.has(position);
    }

    return false;
  };

  const isDepartmentOccupied = (department: UserServiceDepartment): boolean => {
    return false;
  };

  const hasUniqueServicePosition = (position: 'coordinador' | 'secretario'): boolean =>
    serviceAssignments.some((assignment) => assignment.position === position);

  const selectedDraftAssignment = useMemo<UserServiceAssignment | null>(() => {
    if (servicePositionDraft === 'none') return null;
    const department = needsDepartment(servicePositionDraft) ? serviceDepartmentDraft : '';
    const label = buildDepartmentLabel(servicePositionDraft, department);
    return label
      ? {
        position: servicePositionDraft,
        department: department || undefined,
        label,
      }
      : null;
  }, [serviceDepartmentDraft, servicePositionDraft]);

  const addServiceAssignment = () => {
    if (!isAdmin || !selectedDraftAssignment) return;
    if (serviceAssignments.some((item) => assignmentKey(item) === assignmentKey(selectedDraftAssignment))) {
      setErrors((current) => ({ ...current, assignment: 'Esta funcion ya esta agregada.' }));
      return;
    }
    if (isPositionOccupied(selectedDraftAssignment.position)) {
      setErrors((current) => ({ ...current, assignment: 'Esta funcion ya esta ocupada.' }));
      return;
    }
    if (
      (
        selectedDraftAssignment.position === 'coordinador' &&
        hasUniqueServicePosition('secretario')
      ) ||
      (
        selectedDraftAssignment.position === 'secretario' &&
        hasUniqueServicePosition('coordinador')
      )
    ) {
      setErrors((current) => ({
        ...current,
        assignment: 'Una misma persona no puede ser Coordinador y Secretario a la vez.',
      }));
      return;
    }
    setServiceAssignments((current) => [...current, selectedDraftAssignment]);
    setServicePositionDraft('none');
    setServiceDepartmentDraft('');
    setErrors((current) => ({ ...current, assignment: undefined }));
  };

  const removeServiceAssignment = (target: UserServiceAssignment) => {
    if (!isAdmin) return;
    setServiceAssignments((current) =>
      current.filter((item) => assignmentKey(item) !== assignmentKey(target))
    );
  };

  // Sincroniza privilegios de nombramiento cuando cambia el rol.
  // Anciano → isElder fijo; Siervo ministerial → isMinisterialServant fijo;
  // Publicador → ninguno marcado (no se pueden asignar manualmente).
  useEffect(() => {
    setPrivileges((current) => {
      const next = { ...current };
      if (role === 'admin') {
        // Anciano
        next.isElder = true;
        next.isMinisterialServant = false;
      } else if (role === 'supervisor') {
        // Siervo ministerial
        next.isElder = false;
        next.isMinisterialServant = true;
      } else {
        // Publicador: ningún nombramiento
        next.isElder = false;
        next.isMinisterialServant = false;
      }
      return next;
    });
  }, [role]);

  const togglePrivilege = (key: keyof UserPrivileges) => {
    if (!isAdmin) return;
    // Anciano y Siervo Ministerial son controlados por el Rol — no se pueden tocar directamente.
    if (key === 'isElder' || key === 'isMinisterialServant') return;

    setPrivileges((current) => {
      const nextValue = !current[key];
      const next: UserPrivileges = {
        ...current,
        [key]: nextValue,
      };

      // Precursor Regular y Auxiliar son mutuamente excluyentes.
      if (key === 'isRegularPioneer' && nextValue) {
        next.isAuxiliaryPioneer = false;
      }
      if (key === 'isAuxiliaryPioneer' && nextValue) {
        next.isRegularPioneer = false;
      }

      return next;
    });
  };

  useEffect(() => {
    if (!positionOptions.includes(servicePositionDraft)) {
      setServicePositionDraft('none');
      setServiceDepartmentDraft('');
      return;
    }

    if (!needsDepartment(servicePositionDraft) && serviceDepartmentDraft) {
      setServiceDepartmentDraft('');
    }
  }, [positionOptions, serviceDepartmentDraft, servicePositionDraft]);

  useEffect(() => {
    if (
      (servicePositionDraft === 'coordinador' || servicePositionDraft === 'secretario') &&
      occupiedAssignments.occupiedUniquePositions.has(servicePositionDraft)
    ) {
      setServicePositionDraft('none');
    }
  }, [occupiedAssignments.occupiedUniquePositions, servicePositionDraft]);

  const validate = (): boolean => {
    const assignmentError = undefined;
    const privilegesError =
      privileges.isRegularPioneer && privileges.isAuxiliaryPioneer
        ? 'Un usuario no puede ser Precursor Regular y Auxiliar al mismo tiempo.'
        : privileges.isElder && privileges.isMinisterialServant
          ? 'Un usuario no puede ser Anciano y Siervo Ministerial al mismo tiempo.'
          : undefined;

    const nextErrors: FormErrors =
      mode === 'create'
        ? {
          firstName: validateRequired(firstName, 'El primer nombre'),
          lastName: validateRequired(lastName, 'El apellido paterno'),
          password:
            validateRequired(password, 'La contrasena') ??
            validateMinLength(password, 6, 'La contrasena'),
          gender: gender ? undefined : 'El genero es requerido.',
          assignment: assignmentError,
          privileges: privilegesError,
        }
        : {
          displayName: validateRequired(displayName, 'El nombre'),
          newPassword:
            newPassword.trim().length > 0
              ? validateMinLength(newPassword, 6, 'La nueva contrasena')
              : undefined,
          gender: gender ? undefined : 'El genero es requerido.',
          assignment: assignmentError,
          privileges: privilegesError,
        };

    setErrors(nextErrors);
    return !hasErrors(nextErrors as Record<string, string | undefined>);
  };

  const handleSave = async () => {
    if (!canEdit) {
      Alert.alert('Permisos insuficientes', mode === 'edit' ? 'Solo administradores y ancianos pueden editar usuarios.' : 'Solo administradores pueden crear usuarios.');
      return;
    }

    if (!congregationId) {
      Alert.alert('Error', profileError ?? 'No se encontro la congregacion del usuario actual.');
      return;
    }

    if (!validate()) return;

    setSaving(true);

    try {
      const selectedGender = gender;
      if (!selectedGender) {
        setErrors((current) => ({ ...current, gender: 'El genero es requerido.' }));
        setSaving(false);
        return;
      }

      const normalizedMiddle = middleName.trim() || undefined;
      const normalizedFirstName = firstName.trim();
      const normalizedLastName = lastName.trim();
      const normalizedSecondLastName = secondLastName.trim() || undefined;
      const normalizedPhone = phone.trim() || undefined;
      const primaryAssignment = serviceAssignments[0];
      const normalizedServicePosition = primaryAssignment?.position;
      const normalizedServiceDepartment = primaryAssignment?.department;
      const departmentLabel = primaryAssignment?.label;

      if (mode === 'create') {
        const createdUser = await createUserByAdmin({
          firstName: normalizedFirstName,
          middleName: normalizedMiddle,
          lastName: normalizedLastName,
          secondLastName: normalizedSecondLastName,
          password: password.trim(),
          displayName: [normalizedFirstName, normalizedMiddle, normalizedLastName, normalizedSecondLastName]
            .filter(Boolean)
            .join(' ')
            .trim(),
          email: generatedEmailPreview,
          role,
          congregationId,
          gender: selectedGender,
          phone: normalizedPhone,
          department: departmentLabel,
          servicePosition: normalizedServicePosition,
          serviceDepartment: normalizedServiceDepartment,
          serviceAssignments,
          privileges,
          responsibilities,
          isElder: privileges.isElder === true,
          isMinisterialServant: privileges.isMinisterialServant === true,
          isActive: true,
        });
        const assignedEmail = createdUser.email ?? generatedEmailPreview;
        const credentialsText = `Correo: ${assignedEmail}\nContrasena: ${password}`;

        Alert.alert(
          'Usuario creado',
          `Correo asignado: ${assignedEmail}\nContrasena inicial: ${password}\nDominio: @${createdUser.requiredDomain ?? allowedEmailDomain}`,
          [
            {
              text: 'Copiar credenciales',
              onPress: () => {
                void copyToClipboard(credentialsText).finally(() => router.back());
              },
            },
            {
              text: 'Cerrar',
              onPress: () => router.back(),
            },
          ]
        );
        return;
      } else if (id) {
        const payload: UpdateUserDTO = {
          displayName: displayName.trim(),
          role,
          gender: selectedGender,
          phone: normalizedPhone,
          department: departmentLabel,
          servicePosition: normalizedServicePosition,
          serviceDepartment: normalizedServiceDepartment,
          serviceAssignments,
          privileges,
          responsibilities,
          isElder: privileges.isElder === true,
          isMinisterialServant: privileges.isMinisterialServant === true,
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
        {!canEdit ? (
          <View style={styles.permissionNotice}>
            <ThemedText style={styles.permissionText}>
              {mode === 'edit' ? 'Solo administradores y ancianos pueden editar usuarios.' : 'Solo administradores pueden crear usuarios.'}
            </ThemedText>
          </View>
        ) : null}

        {mode === 'create' && planUsage ? (
          <View style={styles.planNotice}>
            <ThemedText style={styles.planTitle}>{planUsage.planLabel}</ThemedText>
            <ThemedText style={styles.hintText}>
              Active users: {planUsage.activeUsersCount}/{planUsage.activeUsersLimit}. Available: {planUsage.remainingActiveUsers}.
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
                onCopy={() => void handleCopyValue('Contrasena', password)}
                hasError={Boolean(errors.password)}
                editable={isAdmin}
              />
            </Field>

            <Field label="Correo generado automaticamente">
              <View style={styles.copyInputWrap}>
                <TextInput
                  style={styles.copyInput}
                  value={generatedEmailPreview}
                  editable={false}
                />
                <TouchableOpacity
                  style={styles.copyButton}
                  onPress={() => void handleCopyValue('Correo', generatedEmailPreview)}
                  activeOpacity={0.8}
                  disabled={!generatedEmailPreview.trim()}
                >
                  <Ionicons name="copy-outline" size={18} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
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
                editable={canEdit}
              />
            </Field>

            <Field label="Nueva contrasena (opcional)" error={errors.newPassword}>
              <PasswordInput
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Dejar vacio para no cambiar"
                visible={showNewPassword}
                onToggleVisibility={() => setShowNewPassword((value) => !value)}
                onCopy={() => void handleCopyValue('Nueva contrasena', newPassword)}
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

        <Field label="Genero *" error={errors.gender}>
          <View style={styles.roleRow}>
            {genderOptions.map((item) => (
              <TouchableOpacity
                key={item}
                style={[styles.roleChip, gender === item && styles.roleChipActive]}
                onPress={() => setGender(item)}
                activeOpacity={0.8}
                disabled={!canEdit}
              >
                <ThemedText style={[styles.roleChipText, gender === item && styles.roleChipTextActive]}>
                  {GENDER_LABELS[item]}
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
            editable={canEdit}
          />
        </Field>

        <Field label="Asignacion de servicio" error={errors.assignment}>
          {serviceAssignments.length > 0 ? (
            <View style={styles.assignmentList}>
              {serviceAssignments.map((assignment) => (
                <View key={assignmentKey(assignment)} style={styles.assignmentPill}>
                  <ThemedText style={styles.assignmentPillText}>{assignment.label}</ThemedText>
                  <TouchableOpacity
                    style={styles.assignmentRemove}
                    onPress={() => removeServiceAssignment(assignment)}
                    disabled={!isAdmin}
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
            {positionOptions.map((item) => {
              const disabledByAssignment = isPositionOccupied(item);
              const disabled = !isAdmin || disabledByAssignment;

              return (
                <TouchableOpacity
                  key={item}
                  style={[
                    styles.departmentChip,
                    servicePositionDraft === item && styles.departmentChipActive,
                    disabledByAssignment && styles.departmentChipDisabled,
                  ]}
                  onPress={() => {
                    if (disabled) return;
                    setServicePositionDraft(item);
                  }}
                  activeOpacity={0.8}
                  disabled={disabled}
                >
                  <ThemedText
                    style={[
                      styles.departmentChipText,
                      servicePositionDraft === item && styles.departmentChipTextActive,
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

        {needsDepartment(servicePositionDraft) ? (
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
                      serviceDepartmentDraft === item && styles.departmentChipActive,
                      disabledByAssignment && styles.departmentChipDisabled,
                    ]}
                    onPress={() => {
                      if (disabled) return;
                      setServiceDepartmentDraft(item);
                    }}
                    activeOpacity={0.8}
                    disabled={disabled}
                  >
                    <ThemedText
                      style={[
                        styles.departmentChipText,
                        serviceDepartmentDraft === item && styles.departmentChipTextActive,
                        disabledByAssignment && styles.departmentChipTextDisabled,
                      ]}
                    >
                      {USER_SERVICE_DEPARTMENT_LABELS[item]}
                    </ThemedText>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity
              style={[
                styles.addAssignmentButton,
                (!selectedDraftAssignment || !canEdit) && styles.addAssignmentButtonDisabled,
              ]}
              onPress={addServiceAssignment}
              disabled={!selectedDraftAssignment || !canEdit}
              activeOpacity={0.8}
            >
              <Ionicons name="add-outline" size={16} color={colors.primary} />
              <ThemedText style={styles.addAssignmentText}>Agregar funcion</ThemedText>
            </TouchableOpacity>
          </Field>
        ) : servicePositionDraft !== 'none' ? (
          <TouchableOpacity
            style={[
              styles.addAssignmentButton,
              (!selectedDraftAssignment || !canEdit) && styles.addAssignmentButtonDisabled,
            ]}
            onPress={addServiceAssignment}
            disabled={!selectedDraftAssignment || !canEdit}
            activeOpacity={0.8}
          >
            <Ionicons name="add-outline" size={16} color={colors.primary} />
            <ThemedText style={styles.addAssignmentText}>Agregar funcion</ThemedText>
          </TouchableOpacity>
        ) : null}

        <Field label="Privilegios / nombramientos" error={errors.privileges}>
          <ThemedText style={styles.hintText}>
            El nombramiento de Anciano o Siervo Ministerial se asigna automaticamente segun el Rol seleccionado.
          </ThemedText>
          <View style={styles.departmentRow}>
            {/* Anciano y Siervo Ministerial: bloqueados, derivados del Rol */}
            <ToggleChip
              label={PRIVILEGE_LABELS.isElder}
              selected={Boolean(privileges.isElder)}
              disabled={true}
              onPress={() => { }}
            />
            <ToggleChip
              label={PRIVILEGE_LABELS.isMinisterialServant}
              selected={Boolean(privileges.isMinisterialServant)}
              disabled={true}
              onPress={() => { }}
            />
            {/* Precursor: libre, mutuamente excluyente */}
            <ToggleChip
              label={PRIVILEGE_LABELS.isRegularPioneer}
              selected={Boolean(privileges.isRegularPioneer)}
              disabled={!canEdit}
              onPress={() => togglePrivilege('isRegularPioneer')}
            />
            <ToggleChip
              label={PRIVILEGE_LABELS.isAuxiliaryPioneer}
              selected={Boolean(privileges.isAuxiliaryPioneer)}
              disabled={!canEdit}
              onPress={() => togglePrivilege('isAuxiliaryPioneer')}
            />
          </View>
        </Field>

        <TouchableOpacity
          style={[styles.saveButton, (saving || !canEdit) && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving || !canEdit}
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
  onCopy,
  hasError,
  editable,
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  visible: boolean;
  onToggleVisibility: () => void;
  onCopy?: () => void;
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
      {onCopy ? (
        <TouchableOpacity
          style={styles.eyeButton}
          onPress={onCopy}
          activeOpacity={0.8}
          disabled={!value.trim()}
        >
          <Ionicons name="copy-outline" size={18} color={colors.textMuted} />
        </TouchableOpacity>
      ) : null}
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

function ToggleChip({
  label,
  selected,
  disabled,
  onPress,
}: {
  label: string;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const colors = useAppColors();
  const styles = createStyles(colors);

  return (
    <TouchableOpacity
      style={[
        styles.departmentChip,
        selected && styles.departmentChipActive,
        disabled && styles.departmentChipDisabled,
      ]}
      onPress={onPress}
      activeOpacity={0.8}
      disabled={disabled}
    >
      <ThemedText
        style={[
          styles.departmentChipText,
          selected && styles.departmentChipTextActive,
          disabled && styles.departmentChipTextDisabled,
        ]}
      >
        {label}
      </ThemedText>
    </TouchableOpacity>
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
    copyInputWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surfaceRaised,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingLeft: 12,
      paddingRight: 8,
    },
    copyInput: {
      flex: 1,
      paddingVertical: 12,
      fontSize: 15,
      color: colors.textMuted,
    },
    copyButton: {
      padding: 6,
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
    assignmentList: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 4,
    },
    assignmentPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderWidth: 1,
      borderColor: colors.primary + '66',
      backgroundColor: colors.primary + '14',
      borderRadius: 999,
      paddingLeft: 12,
      paddingRight: 6,
      paddingVertical: 6,
    },
    assignmentPillText: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: '800',
    },
    assignmentRemove: {
      width: 22,
      height: 22,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
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
    addAssignmentButton: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderWidth: 1,
      borderColor: colors.primary + '66',
      backgroundColor: colors.primary + '12',
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      marginTop: 8,
    },
    addAssignmentButtonDisabled: {
      opacity: 0.45,
    },
    addAssignmentText: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: '800',
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
    planNotice: {
      borderWidth: 1,
      borderColor: colors.primary + '55',
      backgroundColor: colors.primary + '12',
      borderRadius: 10,
      padding: 12,
      gap: 4,
    },
    planTitle: {
      color: colors.primary,
      fontSize: 13,
      fontWeight: '800',
    },
  });
