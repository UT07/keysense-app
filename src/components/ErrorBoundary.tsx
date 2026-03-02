/**
 * ErrorBoundary — Catches uncaught JS errors and shows a recovery UI
 * instead of a white screen crash. Wraps the entire app in App.tsx.
 */

import React, { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY } from '../theme/tokens';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    if (__DEV__) {
      console.error('[ErrorBoundary] Uncaught error:', error, info.componentStack);
    }
    // TODO: Log to Crashlytics when integrated
  }

  private handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    if (this.props.fallback) {
      return this.props.fallback;
    }

    return (
      <View style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.emoji}>🐱</Text>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.subtitle}>
            Don't worry — your progress is saved. Tap below to try again.
          </Text>

          {__DEV__ && this.state.error && (
            <ScrollView style={styles.errorBox} contentContainerStyle={styles.errorBoxContent}>
              <Text style={styles.errorText}>{this.state.error.message}</Text>
            </ScrollView>
          )}

          <TouchableOpacity style={styles.button} onPress={this.handleReset}>
            <Text style={styles.buttonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  content: {
    alignItems: 'center',
    maxWidth: 320,
  },
  emoji: {
    fontSize: 64,
    marginBottom: SPACING.lg,
  },
  title: {
    ...TYPOGRAPHY.heading.lg,
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  subtitle: {
    ...TYPOGRAPHY.body.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.xl,
  },
  errorBox: {
    maxHeight: 120,
    width: '100%',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.sm,
    marginBottom: SPACING.lg,
  },
  errorBoxContent: {
    padding: SPACING.sm,
  },
  errorText: {
    ...TYPOGRAPHY.caption.md,
    color: COLORS.error,
    fontFamily: 'monospace',
  },
  button: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderRadius: BORDER_RADIUS.lg,
    minWidth: 160,
    alignItems: 'center',
  },
  buttonText: {
    ...TYPOGRAPHY.button.lg,
    color: COLORS.textPrimary,
  },
});
