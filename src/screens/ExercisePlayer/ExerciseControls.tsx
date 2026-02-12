/**
 * Exercise Controls Component
 * Play, pause, restart, and exit controls
 * Responsive layout for mobile and tablet
 */

import React, { useCallback } from 'react';
import {
  View,
  StyleSheet,
  AccessibilityInfo,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Button } from '../../components/common/Button';

export interface ExerciseControlsProps {
  isPlaying: boolean;
  isPaused: boolean;
  onStart: () => void;
  onPause: () => void;
  onRestart: () => void;
  onExit: () => void;
  compact?: boolean;
  testID?: string;
}

/**
 * ExerciseControls - Control buttons for exercise playback
 * Handles: Play/Resume, Pause, Restart, Exit
 */
export const ExerciseControls: React.FC<ExerciseControlsProps> = ({
  isPlaying,
  isPaused,
  onStart,
  onPause,
  onRestart,
  onExit,
  compact = false,
  testID,
}) => {
  const handlePlayPress = useCallback(() => {
    onStart();
    if (Platform.OS === 'web') {
      AccessibilityInfo.announceForAccessibility('Started exercise');
    }
  }, [onStart]);

  const handlePausePress = useCallback(() => {
    onPause();
  }, [onPause]);

  const handleRestartPress = useCallback(() => {
    onRestart();
    if (Platform.OS === 'web') {
      AccessibilityInfo.announceForAccessibility('Exercise restarted');
    }
  }, [onRestart]);

  const handleExitPress = useCallback(() => {
    onExit();
  }, [onExit]);

  if (compact) {
    return (
      <View style={styles.compactContainer} testID={testID}>
        {!isPlaying ? (
          <TouchableOpacity
            onPress={handlePlayPress}
            style={styles.compactButton}
            testID="control-play"
            accessibilityLabel="Play exercise"
          >
            <MaterialCommunityIcons name="play" size={20} color="#2196F3" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={handlePausePress}
            style={styles.compactButton}
            testID="control-pause"
            accessibilityLabel={isPaused ? 'Resume' : 'Pause'}
          >
            <MaterialCommunityIcons
              name={isPaused ? 'play' : 'pause'}
              size={20}
              color="#2196F3"
            />
          </TouchableOpacity>
        )}

        {isPlaying && (
          <TouchableOpacity
            onPress={handleRestartPress}
            style={styles.compactButton}
            testID="control-restart"
            accessibilityLabel="Restart"
          >
            <MaterialCommunityIcons name="restart" size={20} color="#757575" />
          </TouchableOpacity>
        )}

        <TouchableOpacity
          onPress={handleExitPress}
          style={styles.compactButton}
          testID="control-exit"
          accessibilityLabel="Exit"
        >
          <MaterialCommunityIcons name="close" size={20} color="#F44336" />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container} testID={testID}>
      <View style={styles.mainControls}>
        {/* Play / Resume button */}
        {!isPlaying ? (
          <Button
            title="Play"
            onPress={handlePlayPress}
            variant="primary"
            size="large"
            icon={<MaterialCommunityIcons name="play" size={20} color="#FFF" />}
            style={styles.playButton}
            testID="control-play"
            accessibilityLabel="Play exercise"
            accessibilityHint="Starts or resumes the exercise"
          />
        ) : (
          <Button
            title={isPaused ? 'Resume' : 'Pause'}
            onPress={handlePausePress}
            variant={isPaused ? 'primary' : 'secondary'}
            size="large"
            icon={
              <MaterialCommunityIcons
                name={isPaused ? 'play' : 'pause'}
                size={20}
                color="#FFF"
              />
            }
            style={styles.playButton}
            testID="control-pause"
            accessibilityLabel={isPaused ? 'Resume exercise' : 'Pause exercise'}
            accessibilityHint="Pauses or resumes playback"
          />
        )}

        {/* Restart button (only show if playing) */}
        {isPlaying && (
          <Button
            title="Restart"
            onPress={handleRestartPress}
            variant="outline"
            size="large"
            icon={<MaterialCommunityIcons name="restart" size={20} color="#2196F3" />}
            testID="control-restart"
            accessibilityLabel="Restart exercise"
            accessibilityHint="Restarts the exercise from the beginning"
          />
        )}
      </View>

      {/* Exit button (separate row) */}
      <Button
        title="Exit"
        onPress={handleExitPress}
        variant="danger"
        size="medium"
        icon={<MaterialCommunityIcons name="close" size={18} color="#FFF" />}
        style={styles.exitButton}
        testID="control-exit"
        accessibilityLabel="Exit exercise"
        accessibilityHint="Exits the exercise without saving progress"
      />
    </View>
  );
};

ExerciseControls.displayName = 'ExerciseControls';

const styles = StyleSheet.create({
  // Compact mode styles
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  compactButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Full mode styles
  container: {
    gap: 12,
  },
  mainControls: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
  },
  playButton: {
    flex: 1,
    minHeight: 56,
  },
  exitButton: {
    minHeight: 44,
  },
});

export default ExerciseControls;
