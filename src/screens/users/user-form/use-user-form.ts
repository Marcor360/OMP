import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';

import { useToast } from '@/src/context/toast-context';
import { useUser } from '@/src/context/user-context';
import { useI18n } from '@/src/i18n/index';
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
import type {
  AppUser,
  PermissionAction,
  PermissionDepartment,
  TerritoryPermissionAction,
  UserGender,
  UserPermissions,
  UserPrivileges,
  UserResponsibilities,
  UserRole,
  UserServiceAssignment,
  UserServiceDepartment,
  UserServicePosition,
} from '@/src/types/user';
import { USER_SERVICE_DEPARTMENT_LABELS } from '@/src/types/user';
import { copyToClipboard } from '@/src/utils/clipboard/clipboard';
import { AppError, formatFirestoreError } from '@/src/utils/errors/errors';
import { showAlert } from '@/src/utils/ui/alerts';
import {
  assignmentKey,
  buildDepartmentLabel,
  buildGeneratedEmailPreview,
  ensureAdminElderPrivileges,
  needsDepartment,
  normalizeServiceAssignmentForPayload,
  requiresAdminElderAssignment,
  resolveServiceAssignmentFromUser,
  toCreatePayload,
  toFormValues,
  toUpdatePayload,
} from '@/src/screens/users/user-form/user-form.mapper';
import {
  canEditUserForm,
  getAllowedPermissionLabels,
  getUserFormEffectivePermissions,
} from '@/src/screens/users/user-form/user-form.permissions';
import type {
  ServiceSelection,
  UserFormController,
  UserFormErrors,
  UserFormMode,
} from '@/src/screens/users/user-form/user-form.types';
import {
  hasUserFormErrors,
  validateUserForm,
} from '@/src/screens/users/user-form/user-form.validators';

export const useUserForm = (): UserFormController => {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const mode: UserFormMode = id ? 'edit' : 'create';
  const { showToast } = useToast();
  const { t } = useI18n();
  const { appUser, congregationId, isAdmin, loadingProfile, profileError } = useUser();
  const canEdit = canEditUserForm(appUser, mode);

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
  const [permissions, setPermissions] = useState<UserPermissions>({});
  const [allowedEmailDomain, setAllowedEmailDomain] = useState('congregacion.com');
  const [planUsage, setPlanUsage] = useState<UserFormController['state']['planUsage']>(null);
  const [errors, setErrors] = useState<UserFormErrors>({});
  const [loading, setLoading] = useState(mode === 'edit');
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

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
          showAlert('Error', 'Usuario no encontrado.');
          router.back();
          return;
        }

        if (loadedUser.congregationId !== congregationId) {
          showAlert('Error', 'No tienes permisos para editar este usuario.');
          router.back();
          return;
        }

        if (loadedUser.role === 'admin' && !isAdmin) {
          showAlert(t('users.error.actionNotAllowed'), t('users.error.cannotManageAdmin'));
          router.back();
          return;
        }

        const formValues = toFormValues(loadedUser);
        setDisplayName(formValues.displayName);
        setRole(formValues.role);
        setGender(formValues.gender);
        setPhone(formValues.phone);
        setServiceAssignments(formValues.serviceAssignments);
        setPrivileges(formValues.privileges);
        setResponsibilities(formValues.responsibilities);
        setPermissions(formValues.permissions);
      })
      .catch((requestError) => {
        showAlert('Error', formatFirestoreError(requestError));
        router.back();
      })
      .finally(() => setLoading(false));
  }, [congregationId, id, isAdmin, loadingProfile, mode, router, t]);

  const generatedEmailPreview = useMemo(
    () => buildGeneratedEmailPreview(firstName, middleName, lastName, allowedEmailDomain),
    [allowedEmailDomain, firstName, middleName, lastName]
  );

  const handleCopyValue = async (label: string, value: string) => {
    if (!value.trim()) {
      showAlert('Sin datos', `No hay ${label.toLowerCase()} para copiar.`);
      return;
    }

    try {
      await copyToClipboard(value);
      showAlert('Copiado', `${label} copiado al portapapeles.`);
    } catch {
      showAlert('No se pudo copiar', 'Intenta seleccionar el texto manualmente.');
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
    const occupiedManagerDepartments = new Set<UserServiceDepartment>();

    activeUsers.forEach((user) => {
      if (id && user.uid === id) return;

      resolveServiceAssignmentFromUser(user).forEach((assignment) => {
        if (
          assignment.position === 'coordinador' ||
          assignment.position === 'secretario'
        ) {
          occupiedUniquePositions.add(assignment.position);
        }

        if (assignment.position === 'encargado' && assignment.department) {
          occupiedManagerDepartments.add(assignment.department);
        }
      });
    });

    return {
      occupiedUniquePositions,
      occupiedManagerDepartments,
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
    if (servicePositionDraft === 'none') return false;

    const alreadyAssignedToCurrentUser = serviceAssignments.some(
      (assignment) =>
        assignment.position === servicePositionDraft &&
        assignment.department === department
    );

    if (alreadyAssignedToCurrentUser) return true;

    return (
      servicePositionDraft === 'encargado' &&
      occupiedAssignments.occupiedManagerDepartments.has(department)
    );
  };

  const isDraftAssignmentUnavailable = (assignment: UserServiceAssignment | null): boolean => {
    if (!assignment) return true;
    if (serviceAssignments.some((item) => assignmentKey(item) === assignmentKey(assignment))) return true;
    if (isPositionOccupied(assignment.position)) return true;
    return (
      assignment.position === 'encargado' &&
      Boolean(assignment.department) &&
      occupiedAssignments.occupiedManagerDepartments.has(assignment.department as UserServiceDepartment)
    );
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

  const assignmentsRequiringAdminElder = useMemo(
    () =>
      selectedDraftAssignment
        ? [...serviceAssignments, selectedDraftAssignment]
        : serviceAssignments,
    [selectedDraftAssignment, serviceAssignments]
  );
  const requiresAdminElder = requiresAdminElderAssignment(assignmentsRequiringAdminElder);

  useEffect(() => {
    if (!requiresAdminElder) return;

    setRole((current) => (current === 'admin' ? current : 'admin'));
    setPrivileges((current) =>
      current.isElder === true && current.isMinisterialServant !== true
        ? current
        : { ...current, isElder: true, isMinisterialServant: false }
    );
  }, [requiresAdminElder]);

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
      selectedDraftAssignment.position === 'encargado' &&
      selectedDraftAssignment.department &&
      occupiedAssignments.occupiedManagerDepartments.has(selectedDraftAssignment.department)
    ) {
      const department = selectedDraftAssignment.department;
      setErrors((current) => ({
        ...current,
        assignment: `Ya existe un Encargado de ${USER_SERVICE_DEPARTMENT_LABELS[department]} activo en esta congregacion.`,
      }));
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
    if (requiresAdminElderAssignment([selectedDraftAssignment])) {
      setRole('admin');
      setPrivileges((current) => ({
        ...current,
        isElder: true,
        isMinisterialServant: false,
      }));
    }
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

  const togglePrivilege = (key: keyof UserPrivileges) => {
    if (!isAdmin) return;

    setPrivileges((current) => {
      const nextValue = !current[key];
      const next: UserPrivileges = {
        ...current,
        [key]: nextValue,
      };

      if (key === 'isElder' && nextValue) {
        next.isMinisterialServant = false;
      }
      if (key === 'isMinisterialServant' && nextValue) {
        next.isElder = false;
      }
      if (key === 'isRegularPioneer' && nextValue) {
        next.isAuxiliaryPioneer = false;
      }
      if (key === 'isAuxiliaryPioneer' && nextValue) {
        next.isRegularPioneer = false;
      }

      return next;
    });
  };

  const togglePermission = (department: PermissionDepartment, action: PermissionAction) => {
    if (!isAdmin || role !== 'supervisor') return;

    setPermissions((current) => ({
      ...current,
      [department]: {
        ...(current[department] ?? {}),
        [action]: !(current[department]?.[action] === true),
      },
    }));
  };

  const toggleTerritoryPermission = (action: TerritoryPermissionAction) => {
    if (!isAdmin || role !== 'supervisor') return;

    setPermissions((current) => ({
      ...current,
      predicacion: {
        ...(current.predicacion ?? {}),
        territories: {
          ...(current.predicacion?.territories ?? {}),
          [action]: !(current.predicacion?.territories?.[action] === true),
        },
      },
    }));
  };

  const effectivePermissions = useMemo(
    () => getUserFormEffectivePermissions({ role, permissions, serviceAssignments }),
    [permissions, role, serviceAssignments]
  );

  const allowedPermissionLabels = useMemo(
    () => getAllowedPermissionLabels(effectivePermissions),
    [effectivePermissions]
  );

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

  useEffect(() => {
    if (
      servicePositionDraft === 'encargado' &&
      serviceDepartmentDraft &&
      occupiedAssignments.occupiedManagerDepartments.has(serviceDepartmentDraft)
    ) {
      setServiceDepartmentDraft('');
    }
  }, [occupiedAssignments.occupiedManagerDepartments, serviceDepartmentDraft, servicePositionDraft]);

  const validate = (): boolean => {
    const nextErrors = validateUserForm({
      mode,
      displayName,
      firstName,
      lastName,
      password,
      newPassword,
      hasGender: Boolean(gender),
      privileges,
    });

    setErrors(nextErrors);
    return !hasUserFormErrors(nextErrors);
  };

  const resetSaving = (): void => {
    savingRef.current = false;
    setSaving(false);
  };

  const handleSave = async () => {
    if (savingRef.current) return;

    if (!canEdit) {
      showAlert('Permisos insuficientes', 'Necesitas permiso para crear o editar usuarios.');
      return;
    }

    if (!congregationId) {
      showAlert('Error', profileError ?? 'No se encontro la congregacion del usuario actual.');
      return;
    }

    if (!validate()) return;

    savingRef.current = true;
    setSaving(true);

    try {
      const selectedGender = gender;
      if (!selectedGender) {
        setErrors((current) => ({ ...current, gender: 'El genero es requerido.' }));
        resetSaving();
        return;
      }

      let finalServiceAssignments = serviceAssignments.map(normalizeServiceAssignmentForPayload);

      if (
        selectedDraftAssignment &&
        !finalServiceAssignments.some((item) => assignmentKey(item) === assignmentKey(selectedDraftAssignment))
      ) {
        if (isPositionOccupied(selectedDraftAssignment.position)) {
          setErrors((current) => ({ ...current, assignment: 'Esta funcion ya esta ocupada.' }));
          resetSaving();
          return;
        }

        if (
          selectedDraftAssignment.position === 'encargado' &&
          selectedDraftAssignment.department &&
          occupiedAssignments.occupiedManagerDepartments.has(selectedDraftAssignment.department)
        ) {
          const department = selectedDraftAssignment.department;
          setErrors((current) => ({
            ...current,
            assignment: `Ya existe un Encargado de ${USER_SERVICE_DEPARTMENT_LABELS[department]} activo en esta congregacion.`,
          }));
          resetSaving();
          return;
        }

        finalServiceAssignments = [
          ...finalServiceAssignments,
          normalizeServiceAssignmentForPayload(selectedDraftAssignment),
        ];
      }

      const finalRole: UserRole = requiresAdminElderAssignment(finalServiceAssignments) ? 'admin' : role;
      const finalPrivileges = ensureAdminElderPrivileges(finalServiceAssignments, privileges);

      if (mode === 'create') {
        const createdUser = await createUserByAdmin(
          toCreatePayload({
            mode,
            isAdmin,
            displayName,
            firstName,
            middleName,
            lastName,
            secondLastName,
            password,
            email: generatedEmailPreview,
            role: finalRole,
            congregationId,
            gender: selectedGender,
            phone,
            serviceAssignments: finalServiceAssignments,
            privileges: finalPrivileges,
            responsibilities,
            permissions,
          })
        );
        const verifiedUser = await getUserById(createdUser.uid, { forceServer: true });

        if (!verifiedUser || verifiedUser.congregationId !== congregationId) {
          throw new AppError(
            'La funcion respondio, pero el perfil no quedo guardado en Firestore. Intenta de nuevo.'
          );
        }

        showToast(t('users.toast.created'));
        router.replace('/(protected)/(tabs)/users');
        return;
      }

      if (id) {
        const payload = toUpdatePayload({
          mode,
          isAdmin,
          displayName,
          firstName,
          middleName,
          lastName,
          secondLastName,
          password,
          email: generatedEmailPreview,
          role: finalRole,
          congregationId,
          gender: selectedGender,
          phone,
          serviceAssignments: finalServiceAssignments,
          privileges: finalPrivileges,
          responsibilities,
          permissions,
        });

        await updateUserByAdmin({ uid: id, data: payload });

        if (isAdmin && newPassword.trim().length > 0) {
          await updateUserPasswordByAdmin({
            uid: id,
            newPassword: newPassword.trim(),
          });
        }

        const verifiedUser = await getUserById(id, { forceServer: true });

        if (!verifiedUser) {
          throw new AppError('La funcion respondio, pero no se pudo confirmar el usuario actualizado.');
        }

        if (isAdmin) {
          const expectedPrivileges = finalPrivileges;
          const privilegesMismatch =
            Boolean(verifiedUser.privileges?.isElder) !== Boolean(expectedPrivileges.isElder) ||
            Boolean(verifiedUser.privileges?.isMinisterialServant) !== Boolean(expectedPrivileges.isMinisterialServant) ||
            Boolean(verifiedUser.privileges?.isRegularPioneer) !== Boolean(expectedPrivileges.isRegularPioneer) ||
            Boolean(verifiedUser.privileges?.isAuxiliaryPioneer) !== Boolean(expectedPrivileges.isAuxiliaryPioneer);
          const savedAssignments = verifiedUser.serviceAssignments ?? [];
          const assignmentsMismatch =
            savedAssignments.length !== finalServiceAssignments.length ||
            finalServiceAssignments.some((assignment) =>
              !savedAssignments.some((saved) => assignmentKey(saved) === assignmentKey(assignment))
            );

          if (privilegesMismatch || assignmentsMismatch) {
            throw new AppError(
              'La funcion respondio, pero Firestore no reflejo los nombramientos o cargos actualizados. Intenta de nuevo.'
            );
          }
        }

        showToast(t('users.toast.updated'));
        router.replace('/(protected)/(tabs)/users');
        return;
      }

      router.back();
    } catch (requestError) {
      showAlert('Error', formatFirestoreError(requestError));
    } finally {
      resetSaving();
    }
  };

  return {
    mode,
    state: {
      displayName,
      firstName,
      middleName,
      lastName,
      secondLastName,
      password,
      newPassword,
      showPassword,
      showNewPassword,
      role,
      gender,
      phone,
      servicePositionDraft,
      serviceDepartmentDraft,
      serviceAssignments,
      privileges,
      permissions,
      planUsage,
      errors,
      loading,
      loadingProfile,
      saving,
      canEdit,
      isAdmin,
      generatedEmailPreview,
      positionOptions,
      selectedDraftAssignment,
      requiresAdminElder,
      allowedPermissionLabels,
    },
    actions: {
      setDisplayName,
      setFirstName,
      setMiddleName,
      setLastName,
      setSecondLastName,
      setPassword,
      setNewPassword,
      setRole,
      setGender,
      setPhone,
      setServicePositionDraft,
      setServiceDepartmentDraft,
      togglePasswordVisibility: () => setShowPassword((value) => !value),
      toggleNewPasswordVisibility: () => setShowNewPassword((value) => !value),
      handleCopyValue,
      addServiceAssignment,
      removeServiceAssignment,
      togglePrivilege,
      togglePermission,
      toggleTerritoryPermission,
      isPositionOccupied,
      isDepartmentOccupied,
      isDraftAssignmentUnavailable,
      handleSave,
    },
  };
};
