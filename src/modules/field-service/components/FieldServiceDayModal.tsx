/**
 * Modal de captura y edición de horas del día.
 * Módulo: Contador de Horas de Predicación.
 *
 * - Captura horas y minutos por separado (evita decimales)
 * - Valida rangos y formatos antes de guardar
 * - Muestra datos existentes si los hay (modo edición)
 * - Permite borrar el registro del día
 * - Domingo NO puede habilitarse en esta versión
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useAppColors } from '@/src/styles';
import {
  formatMinutes,
  getDayName,
  isSunday,
  parseLocalDate,
  validateTimeInput,
} from '@/src/modules/field-service/utils/field-service-dates';
import type { SaveDayInput } from '@/src/modules/field-service/types/field-service.types';

// ─── Props ────────────────────────────────────────────────────────────────────

interface FieldServiceDayModalProps {
  visible: boolean;
  date: string | null; // YYYY-MM-DD
  existingMinutes: number; // 0 si no hay registro
  onSave: (input: SaveDayInput) => void;
  onDelete: () => void;
  onClose: () => void;
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function FieldServiceDayModal({
  visible,
  date,
  existingMinutes,
  onSave,
  onDelete,
  onClose,
}: FieldServiceDayModalProps) {
  const colors = useAppColors();
  const styles = createStyles(colors);

  const [hoursText, setHoursText] = useState('');
  const [minutesText, setMinutesText] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Poblar campos cuando se abre el modal con datos existentes
  useEffect(() => {
    if (!visible || !date) return;

    setValidationError(null);
    setShowDeleteConfirm(false);

    if (existingMinutes > 0) {
      const h = Math.floor(existingMinutes / 60);
      const m = existingMinutes % 60;
      setHoursText(String(h));
      setMinutesText(String(m));
    } else {
      setHoursText('');
      setMinutesText('');
    }
  }, [visible, date, existingMinutes]);

  const handleSave = useCallback(() => {
    const hours = parseInt(hoursText || '0', 10);
    const mins = parseInt(minutesText || '0', 10);

    const err = validateTimeInput(hours, mins);
    if (err) {
      setValidationError(err);
      return;
    }

    if (hours === 0 && mins === 0) {
      setValidationError('Ingresa al menos 1 minuto');
      return;
    }

    if (!date) return;

    onSave({ date, hours, minutes: mins });
    onClose();
  }, [hoursText, minutesText, date, onSave, onClose]);

  const handleDelete = useCallback(() => {
    if (!showDeleteConfirm) {
      setShowDeleteConfirm(true);
      return;
    }
    onDelete();
    onClose();
  }, [showDeleteConfirm, onDelete, onClose]);

  const handleClose = useCallback(() => {
    setShowDeleteConfirm(false);
    setValidationError(null);
    onClose();
  }, [onClose]);

  if (!date) return null;

  // Domingo no es operativo en esta versión
  const sunday = isSunday(date);
  const dateObj = parseLocalDate(date);
  const dayLabel = dateObj.toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const hasExisting = existingMinutes > 0;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <TouchableWithoutFeedback onPress={handleClose}>
        <View style={styles.overlay} />
      </TouchableWithoutFeedback>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
        pointerEvents="box-none"
      >
        <View style={styles.sheet}>
          {/* ── Handle y cierre ── */}
          <View style={styles.handle} />

          <View style={styles.headerRow}>
            <View style={styles.headerIconWrap}>
              <Ionicons name="time-outline" size={20} color={colors.primary} />
            </View>
            <View style={styles.headerText}>
              <Text style={styles.modalTitle}>
                {hasExisting ? 'Editar horas' : 'Registrar horas'}
              </Text>
              <Text style={styles.modalDateLabel}>{dayLabel}</Text>
            </View>
            <TouchableOpacity
              onPress={handleClose}
              style={styles.closeBtn}
              accessibilityLabel="Cerrar"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {sunday ? (
            /* ── Domingo: no editable ── */
            <View style={styles.sundayMsg}>
              <Ionicons name="ban-outline" size={28} color={colors.textMuted} />
              <Text style={styles.sundayText}>
                Los domingos no se registran en esta versión.
              </Text>
            </View>
          ) : (
            <>
              {/* ── Registro existente ── */}
              {hasExisting && (
                <View style={[styles.existingBanner, { backgroundColor: colors.success + '18', borderColor: colors.success + '44' }]}>
                  <Ionicons name="checkmark-circle-outline" size={16} color={colors.success} />
                  <Text style={[styles.existingText, { color: colors.success }]}>
                    Registrado: {formatMinutes(existingMinutes)}
                  </Text>
                </View>
              )}

              {/* ── Inputs ── */}
              <View style={styles.inputsRow}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Horas</Text>
                  <TextInput
                    style={[styles.input, validationError ? styles.inputError : null]}
                    value={hoursText}
                    onChangeText={(t) => {
                      setHoursText(t.replace(/[^0-9]/g, ''));
                      setValidationError(null);
                    }}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={colors.textDisabled}
                    maxLength={2}
                    returnKeyType="next"
                    accessibilityLabel="Horas"
                  />
                </View>

                <Text style={styles.separator}>:</Text>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Minutos</Text>
                  <TextInput
                    style={[styles.input, validationError ? styles.inputError : null]}
                    value={minutesText}
                    onChangeText={(t) => {
                      setMinutesText(t.replace(/[^0-9]/g, ''));
                      setValidationError(null);
                    }}
                    keyboardType="numeric"
                    placeholder="00"
                    placeholderTextColor={colors.textDisabled}
                    maxLength={2}
                    returnKeyType="done"
                    onSubmitEditing={handleSave}
                    accessibilityLabel="Minutos"
                  />
                </View>
              </View>

              {/* ── Error de validación ── */}
              {validationError ? (
                <View style={styles.errorRow}>
                  <Ionicons name="alert-circle-outline" size={14} color={colors.error} />
                  <Text style={[styles.errorText, { color: colors.error }]}>
                    {validationError}
                  </Text>
                </View>
              ) : null}

              {/* ── Vista previa ── */}
              {(() => {
                const h = parseInt(hoursText || '0', 10);
                const m = parseInt(minutesText || '0', 10);
                const total = (!isNaN(h) ? h : 0) * 60 + (!isNaN(m) ? m : 0);
                if (total <= 0) return null;
                return (
                  <Text style={styles.previewText}>
                    Total: {formatMinutes(total)}
                  </Text>
                );
              })()}

              {/* ── Botones ── */}
              <View style={styles.actionsRow}>
                {hasExisting && (
                  <TouchableOpacity
                    style={[
                      styles.deleteBtn,
                      {
                        backgroundColor: showDeleteConfirm
                          ? colors.error
                          : colors.error + '18',
                        borderColor: showDeleteConfirm
                          ? colors.error
                          : colors.error + '44',
                      },
                    ]}
                    onPress={handleDelete}
                    accessibilityLabel={
                      showDeleteConfirm ? 'Confirmar borrado' : 'Borrar este día'
                    }
                  >
                    <Ionicons
                      name={showDeleteConfirm ? 'trash' : 'trash-outline'}
                      size={16}
                      color={showDeleteConfirm ? '#fff' : colors.error}
                    />
                    <Text
                      style={[
                        styles.deleteBtnText,
                        { color: showDeleteConfirm ? '#fff' : colors.error },
                      ]}
                    >
                      {showDeleteConfirm ? 'Confirmar' : 'Borrar'}
                    </Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[styles.saveBtn, { backgroundColor: colors.primary, flex: 1 }]}
                  onPress={handleSave}
                  accessibilityLabel="Guardar horas"
                >
                  <Ionicons name="checkmark" size={18} color="#fff" />
                  <Text style={styles.saveBtnText}>
                    {hasExisting ? 'Actualizar' : 'Guardar'}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const createStyles = (colors: ReturnType<typeof useAppColors>) =>
  StyleSheet.create({
    overlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.overlay,
    },
    keyboardAvoid: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: colors.backgroundLight,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 20,
      paddingBottom: Platform.OS === 'ios' ? 40 : 24,
      paddingTop: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.12,
      shadowRadius: 16,
      elevation: 10,
    },
    handle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      alignSelf: 'center',
      marginBottom: 16,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 20,
    },
    headerIconWrap: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: colors.primary + '22',
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerText: {
      flex: 1,
    },
    modalTitle: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    modalDateLabel: {
      fontSize: 13,
      color: colors.textMuted,
      marginTop: 2,
      textTransform: 'capitalize',
    },
    closeBtn: {
      padding: 4,
    },
    sundayMsg: {
      alignItems: 'center',
      paddingVertical: 32,
      gap: 12,
    },
    sundayText: {
      fontSize: 14,
      color: colors.textMuted,
      textAlign: 'center',
    },
    existingBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderWidth: 1,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 8,
      marginBottom: 16,
    },
    existingText: {
      fontSize: 13,
      fontWeight: '600',
    },
    inputsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 12,
    },
    inputGroup: {
      flex: 1,
      gap: 6,
    },
    inputLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    input: {
      backgroundColor: colors.surfaceRaised,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
      paddingVertical: 14,
      fontSize: 28,
      fontWeight: '700',
      color: colors.textPrimary,
      textAlign: 'center',
    },
    inputError: {
      borderColor: colors.error,
      backgroundColor: colors.error + '10',
    },
    separator: {
      fontSize: 28,
      fontWeight: '700',
      color: colors.textMuted,
      marginTop: 24,
    },
    errorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 8,
    },
    errorText: {
      fontSize: 13,
      fontWeight: '600',
    },
    previewText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: 16,
    },
    actionsRow: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 8,
    },
    deleteBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderRadius: 12,
      borderWidth: 1,
    },
    deleteBtnText: {
      fontSize: 14,
      fontWeight: '700',
    },
    saveBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
      borderRadius: 12,
    },
    saveBtnText: {
      color: '#fff',
      fontSize: 15,
      fontWeight: '700',
    },
  });
