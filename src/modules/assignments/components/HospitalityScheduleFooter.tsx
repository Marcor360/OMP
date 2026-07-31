import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/src/components/themed-text';
import { type AppColors as AppColorSet, useAppColors } from '@/src/styles';

type Props = {
  complete: number;
  total: number;
  missing: number;
  busy: boolean;
  saving: boolean;
  publishing: boolean;
  published: boolean;
  canPublish: boolean;
  windowErrors: string[];
  labels: { summary: string; save: string; saving: string; publish: string; publishing: string; missing: string };
  onSave: () => void;
  onPublish: () => void;
};

export function HospitalityScheduleFooter(props: Props) {
  const colors = useAppColors();
  const styles = createStyles(colors);
  return (
    <View style={styles.footer}>
      <View style={styles.summaryWrap}>
        <ThemedText style={styles.summary}>{props.labels.summary}</ThemedText>
        {!props.canPublish && !props.published && props.missing > 0 ? (
          <ThemedText style={styles.reason}>{props.labels.missing}</ThemedText>
        ) : null}
        {props.windowErrors.map((message) => (
          <ThemedText key={message} style={styles.reason}>{message}</ThemedText>
        ))}
      </View>
      <View style={styles.actions}>
        <TouchableOpacity style={styles.saveButton} onPress={props.onSave} disabled={props.busy || props.published || props.windowErrors.length > 0} accessibilityRole="button">
          <Ionicons name="save-outline" size={16} color={props.busy || props.published || props.windowErrors.length > 0 ? colors.textDisabled : colors.primary} />
          <ThemedText style={[styles.saveText, (props.busy || props.published || props.windowErrors.length > 0) && styles.disabledText]}>{props.saving ? props.labels.saving : props.labels.save}</ThemedText>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.publishButton, !props.canPublish && styles.publishDisabled]} onPress={props.onPublish} disabled={props.busy || !props.canPublish} accessibilityRole="button">
          <Ionicons name="cloud-upload-outline" size={16} color={props.canPublish ? colors.onPrimary : colors.textDisabled} />
          <ThemedText style={[styles.publishText, !props.canPublish && styles.disabledText]}>{props.publishing ? props.labels.publishing : props.labels.publish}</ThemedText>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const createStyles = (colors: AppColorSet) => StyleSheet.create({
  footer: { borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  summaryWrap: { flex: 1, minWidth: 190, gap: 2 },
  summary: { color: colors.textPrimary, fontSize: 12, fontWeight: '800' },
  reason: { color: colors.warning, fontSize: 10, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 8 },
  saveButton: { minHeight: 42, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.primary, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  saveText: { color: colors.primary, fontSize: 12, fontWeight: '800' },
  publishButton: { minHeight: 42, paddingHorizontal: 14, borderRadius: 10, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  publishDisabled: { backgroundColor: colors.backgroundLight, borderWidth: 1, borderColor: colors.border },
  publishText: { color: colors.onPrimary, fontSize: 12, fontWeight: '800' },
  disabledText: { color: colors.textDisabled },
});
