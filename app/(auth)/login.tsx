import React, { useState } from 'react';
import {
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  View,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthErrorBanner } from '@/src/components/auth/AuthErrorBanner';
import { ThemedText } from '@/src/components/themed-text';
import { ThemedView } from '@/src/components/themed-view';
import { useAuth } from '@/src/hooks/use-auth';
import { type AppColors, useAppColors } from '@/src/styles';
import { isValidLoginEmail } from '@/src/utils/auth-validation';
import { mapAuthError } from '@/src/utils/firebase-auth-errors';
import { LoginValidationErrors } from '@/src/types/auth.types';
import { useI18n } from '@/src/i18n/index';

export default function LoginScreen() {
  const colors = useAppColors();
  const styles = createStyles(colors);
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [errors, setErrors] = useState<LoginValidationErrors>({});
  const [authErrorMessage, setAuthErrorMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const { login } = useAuth();

  const validateForm = (): boolean => {
    const newErrors: LoginValidationErrors = {};

    if (!isValidLoginEmail(email)) {
      newErrors.email = t('auth.validation.emailInvalid');
    }

    if (!password) {
      newErrors.password = t('auth.validation.passwordRequired');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleEmailChange = (value: string) => {
    setEmail(value);
    setAuthErrorMessage(null);
    setErrors((current) => ({ ...current, email: undefined }));
  };

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    setAuthErrorMessage(null);
    setErrors((current) => ({ ...current, password: undefined }));
  };

  const handleLogin = async () => {
    setAuthErrorMessage(null);

    if (!validateForm()) {
      return;
    }

    setIsLoggingIn(true);

    try {
      await login(email.trim(), password);
      // La navegacion se maneja en el layout protegido
    } catch (error) {
      const mappedError = mapAuthError(error);

      if (mappedError.target === 'email') {
        setErrors((current) => ({ ...current, email: t(mappedError.messageKey) }));
      } else {
        setAuthErrorMessage(t(mappedError.messageKey));
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          <ThemedView style={styles.content}>
            <ThemedText type="title" style={styles.title}>
              {t('auth.login.title')}
            </ThemedText>
            <ThemedText style={styles.subtitle}>{t('auth.login.subtitle')}</ThemedText>

            <View style={styles.form}>
              {authErrorMessage ? (
                <AuthErrorBanner
                  message={authErrorMessage}
                  dismissLabel={t('auth.login.error.dismiss')}
                  onDismiss={() => setAuthErrorMessage(null)}
                />
              ) : null}

              <View style={styles.inputContainer}>
                <ThemedText style={styles.label}>{t('auth.login.email')}</ThemedText>
                <TextInput
                  style={[styles.input, errors.email && styles.inputError]}
                  placeholder="tu@email.com"
                  placeholderTextColor={colors.textDisabled}
                  value={email}
                  onChangeText={handleEmailChange}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  returnKeyType="next"
                  editable={!isLoggingIn}
                />
                {errors.email ? (
                  <ThemedText style={styles.errorText} accessibilityLiveRegion="polite">
                    {errors.email}
                  </ThemedText>
                ) : null}
              </View>

              <View style={styles.inputContainer}>
                <ThemedText style={styles.label}>{t('auth.login.password')}</ThemedText>
                <View style={[styles.passwordWrapper, errors.password && styles.inputError]}>
                  <TextInput
                    style={styles.passwordInput}
                    placeholder="********"
                    placeholderTextColor={colors.textDisabled}
                    value={password}
                    onChangeText={handlePasswordChange}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="done"
                    onSubmitEditing={handleLogin}
                    editable={!isLoggingIn}
                  />
                  <TouchableOpacity
                    style={styles.eyeButton}
                    onPress={() => setShowPassword((prev) => !prev)}
                    activeOpacity={0.7}
                    accessibilityLabel={showPassword ? t('auth.password.hide') : t('auth.password.show')}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={22}
                      color={colors.textMuted}
                    />
                  </TouchableOpacity>
                </View>
                {errors.password ? (
                  <ThemedText style={styles.errorText} accessibilityLiveRegion="polite">
                    {errors.password}
                  </ThemedText>
                ) : null}
              </View>

              <TouchableOpacity
                style={[styles.button, isLoggingIn && styles.buttonDisabled]}
                onPress={handleLogin}
                disabled={isLoggingIn}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={t('auth.login.submit')}
                accessibilityState={{ disabled: isLoggingIn, busy: isLoggingIn }}
              >
                {isLoggingIn ? (
                  <ActivityIndicator color={colors.onPrimary} />
                ) : (
                  <ThemedText style={styles.buttonText}>{t('auth.login.submit')}</ThemedText>
                )}
              </TouchableOpacity>
            </View>
          </ThemedView>
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    keyboardContainer: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
      justifyContent: 'center',
    },
    content: {
      padding: 24,
      paddingBottom: 36,
    },
    title: {
      fontSize: 32,
      marginBottom: 8,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 16,
      textAlign: 'center',
      marginBottom: 32,
      opacity: 0.7,
    },
    form: {
      gap: 20,
    },
    inputContainer: {
      gap: 8,
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      color: colors.textPrimary,
      backgroundColor: colors.surface,
    },
    passwordWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderRadius: 8,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      overflow: 'hidden',
    },
    passwordInput: {
      flex: 1,
      padding: 12,
      fontSize: 16,
      color: colors.textPrimary,
      borderWidth: 0,
    },
    eyeButton: {
      paddingHorizontal: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    inputError: {
      borderColor: colors.error,
    },
    errorText: {
      color: colors.error,
      fontSize: 12,
    },
    button: {
      backgroundColor: colors.primary,
      borderRadius: 8,
      padding: 16,
      alignItems: 'center',
      marginTop: 8,
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    buttonText: {
      color: colors.onPrimary,
      fontSize: 16,
      fontWeight: '600',
    },
  });
