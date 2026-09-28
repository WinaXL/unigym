// src/components/ui/AppErrorBoundary.tsx
/**
 * Top-level error boundary.
 *
 * Without one, any render-time throw takes the whole app to a blank screen with
 * no way back. The error text is shown only in development; a release build
 * keeps it out of the UI so internal details are not exposed.
 */
import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Colors } from '../../theme/colors';
import { Typography, Spacing, BorderRadius } from '../../theme';

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

export class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  private handleReset = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    // The theme store may itself be implicated in the failure, so this screen
    // uses fixed colours rather than reading from a hook.
    const palette = Colors.light;

    return (
      <View style={[styles.container, { backgroundColor: palette.background }]}>
        <Text style={styles.emoji}>😕</Text>
        <Text style={[styles.title, { color: palette.textPrimary }]}>
          Something went wrong
        </Text>
        <Text style={[styles.message, { color: palette.textSecondary }]}>
          The app ran into an unexpected problem. Try again, and restart the app
          if it keeps happening.
        </Text>
        {__DEV__ && (
          <Text style={[styles.details, { color: palette.error }]} numberOfLines={6}>
            {error.message}
          </Text>
        )}
        <Pressable
          onPress={this.handleReset}
          style={[styles.button, { backgroundColor: palette.primary }]}
        >
          <Text style={styles.buttonText}>Try Again</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing[8],
    gap: Spacing[3],
  },
  emoji: { fontSize: 48 },
  title: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    textAlign: 'center',
  },
  message: {
    fontSize: Typography.fontSize.base,
    textAlign: 'center',
    maxWidth: 320,
  },
  details: {
    fontSize: Typography.fontSize.xs,
    textAlign: 'center',
    marginTop: Spacing[2],
  },
  button: {
    marginTop: Spacing[5],
    paddingHorizontal: Spacing[8],
    paddingVertical: Spacing[4],
    borderRadius: BorderRadius.lg,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.semibold,
  },
});
