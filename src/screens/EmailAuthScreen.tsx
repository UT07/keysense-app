/**
 * EmailAuthScreen
 * Email sign-in / sign-up with forgot password support
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../stores/authStore';

type Mode = 'signIn' | 'signUp';

export function EmailAuthScreen(): React.ReactElement {
  const navigation = useNavigation();
  const isLoading = useAuthStore((s) => s.isLoading);
  const error = useAuthStore((s) => s.error);
  const signInWithEmail = useAuthStore((s) => s.signInWithEmail);
  const signUpWithEmail = useAuthStore((s) => s.signUpWithEmail);
  const sendPasswordReset = useAuthStore((s) => s.sendPasswordReset);
  const clearError = useAuthStore((s) => s.clearError);

  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const validate = useCallback((): boolean => {
    setValidationError(null);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setValidationError('Please enter a valid email address');
      return false;
    }
    if (password.length < 8) {
      setValidationError('Password must be at least 8 characters');
      return false;
    }
    if (mode === 'signUp' && displayName.trim().length < 2) {
      setValidationError('Display name must be at least 2 characters');
      return false;
    }
    return true;
  }, [email, password, displayName, mode]);

  const handleSubmit = useCallback(async () => {
    if (!validate()) return;
    clearError();

    if (mode === 'signIn') {
      await signInWithEmail(email, password);
    } else {
      await signUpWithEmail(email, password, displayName.trim());
    }
  }, [mode, email, password, displayName, validate, clearError, signInWithEmail, signUpWithEmail]);

  const handleForgotPassword = useCallback(async () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert('Enter Email', 'Please enter your email address first.');
      return;
    }
    await sendPasswordReset(email);
    Alert.alert('Email Sent', 'Check your inbox for a password reset link.');
  }, [email, sendPasswordReset]);

  const switchMode = useCallback((newMode: Mode) => {
    setMode(newMode);
    setValidationError(null);
    clearError();
  }, [clearError]);

  const displayError = validationError || error;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, mode === 'signIn' && styles.activeTab]}
            onPress={() => switchMode('signIn')}
          >
            <Text style={[styles.tabText, mode === 'signIn' && styles.activeTabText]}>Sign In</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, mode === 'signUp' && styles.activeTab]}
            onPress={() => switchMode('signUp')}
          >
            <Text style={[styles.tabText, mode === 'signUp' && styles.activeTabText]}>Create Account</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#666"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            value={email}
            onChangeText={setEmail}
            testID="email-input"
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#666"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            testID="password-input"
          />
          {mode === 'signUp' && (
            <TextInput
              style={styles.input}
              placeholder="Display Name"
              placeholderTextColor="#666"
              autoCapitalize="words"
              value={displayName}
              onChangeText={setDisplayName}
              testID="displayname-input"
            />
          )}

          {displayError && (
            <Text style={styles.errorText} testID="error-text">{displayError}</Text>
          )}

          <TouchableOpacity
            style={styles.submitButton}
            onPress={handleSubmit}
            disabled={isLoading}
            testID="submit-button"
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitText}>
                {mode === 'signIn' ? 'Sign In' : 'Create Account'}
              </Text>
            )}
          </TouchableOpacity>

          {mode === 'signIn' && (
            <TouchableOpacity style={styles.forgotButton} onPress={handleForgotPassword} testID="forgot-password">
              <Text style={styles.forgotText}>Forgot Password?</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0D0D',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 32,
    paddingTop: 60,
  },
  backButton: {
    marginBottom: 24,
  },
  backText: {
    color: '#DC143C',
    fontSize: 16,
  },
  tabs: {
    flexDirection: 'row',
    marginBottom: 32,
    gap: 16,
  },
  tab: {
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#DC143C',
  },
  tabText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
  },
  activeTabText: {
    color: '#FFFFFF',
  },
  form: {
    gap: 16,
  },
  input: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#333',
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 14,
    marginTop: -4,
  },
  submitButton: {
    backgroundColor: '#DC143C',
    borderRadius: 12,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  submitText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  forgotButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  forgotText: {
    color: '#999',
    fontSize: 14,
  },
});
