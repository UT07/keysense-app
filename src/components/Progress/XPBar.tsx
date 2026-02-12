/**
 * XP Bar Component
 * Displays current level and XP progress toward next level
 * Animated XP gain feedback
 */

import React, { useEffect, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Text,
  Dimensions,
  Animated,
} from 'react-native';

export interface XPBarProps {
  currentXP: number; // Total XP earned
  currentLevel: number; // Current level (1+)
  animatedXPGain?: number; // XP just earned (will animate)
}

/**
 * Calculate XP required for a given level
 * Exponential curve: Level 1 = 100, Level 2 = 150, Level 3 = 225, etc.
 * Formula: 100 * 1.5^(level-1)
 */
function calculateXPForLevel(level: number): number {
  return Math.floor(100 * Math.pow(1.5, level - 1));
}

/**
 * Calculate cumulative XP needed to reach a level
 */
function calculateCumulativeXPForLevel(level: number): number {
  let total = 0;
  for (let i = 1; i < level; i++) {
    total += calculateXPForLevel(i);
  }
  return total;
}

/**
 * Get XP progress in current level (0-1)
 */
function getLevelProgress(totalXP: number, level: number): number {
  const xpForThisLevel = calculateXPForLevel(level);
  const cumulativeXPBefore = calculateCumulativeXPForLevel(level);
  const xpInCurrentLevel = totalXP - cumulativeXPBefore;
  return Math.min(1, Math.max(0, xpInCurrentLevel / xpForThisLevel));
}

/**
 * XPBar - Level and experience progress display
 * Shows current level, XP in current level, and animates XP gains
 */
export const XPBar = React.memo(
  ({ currentXP, currentLevel, animatedXPGain = 0 }: XPBarProps) => {
    const screenWidth = Dimensions.get('window').width;

    // Animation values
    const progressAnim = React.useRef(new Animated.Value(0)).current;
    const popAnim = React.useRef(new Animated.Value(1)).current;
    const fadeAnim = React.useRef(new Animated.Value(0)).current;

    // Calculate progress
    const progress = useMemo(
      () => getLevelProgress(currentXP, currentLevel),
      [currentXP, currentLevel]
    );

    const xpForCurrentLevel = useMemo(
      () => calculateXPForLevel(currentLevel),
      [currentLevel]
    );

    const xpInCurrentLevel = useMemo(() => {
      const cumulative = calculateCumulativeXPForLevel(currentLevel);
      return currentXP - cumulative;
    }, [currentXP, currentLevel]);

    // Animate XP gain if provided
    useEffect(() => {
      if (animatedXPGain > 0) {
        // Pop animation for +XP text
        popAnim.setValue(0);
        fadeAnim.setValue(1);

        Animated.parallel([
          Animated.timing(popAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 600,
            delay: 200,
            useNativeDriver: true,
          }),
        ]).start();

        // Animate progress bar
        Animated.timing(progressAnim, {
          toValue: progress,
          duration: 800,
          useNativeDriver: false,
        }).start();
      }
    }, [animatedXPGain, progress]);

    return (
      <View style={styles.container}>
        {/* Level badge and text */}
        <View style={styles.header}>
          <View style={styles.levelBadge}>
            <Text style={styles.levelText}>{currentLevel}</Text>
          </View>
          <View style={styles.textContainer}>
            <Text style={styles.levelLabel}>Level {currentLevel}</Text>
            <Text style={styles.xpLabel}>
              {xpInCurrentLevel} / {xpForCurrentLevel} XP
            </Text>
          </View>

          {/* +XP popup animation */}
          {animatedXPGain > 0 && (
            <Animated.View
              style={[
                styles.xpPopup,
                {
                  opacity: fadeAnim,
                  transform: [
                    {
                      translateY: popAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, -20],
                      }),
                    },
                  ],
                },
              ]}
            >
              <Text style={styles.xpPopupText}>+{animatedXPGain}</Text>
            </Animated.View>
          )}
        </View>

        {/* Progress bar container */}
        <View style={[styles.progressContainer, { width: screenWidth - 32 }]}>
          <Animated.View
            style={[
              styles.progressBar,
              {
                width: progressAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }),
              },
            ]}
          />
        </View>

        {/* Level up notification (optional) */}
        {progress >= 1 && (
          <View style={styles.levelUpContainer}>
            <Text style={styles.levelUpText}>LEVEL UP!</Text>
          </View>
        )}
      </View>
    );
  }
);

XPBar.displayName = 'XPBar';

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  levelBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    shadowColor: '#2196F3',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  levelText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  textContainer: {
    flex: 1,
  },
  levelLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333333',
  },
  xpLabel: {
    fontSize: 12,
    color: '#666666',
    marginTop: 2,
  },
  xpPopup: {
    position: 'absolute',
    right: 16,
    backgroundColor: '#4CAF50',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  xpPopupText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  progressContainer: {
    height: 8,
    backgroundColor: '#EEEEEE',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#2196F3',
    borderRadius: 4,
  },
  levelUpContainer: {
    alignItems: 'center',
    paddingVertical: 8,
    backgroundColor: '#FFF9C4',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#FBC02D',
  },
  levelUpText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#F57F17',
  },
});
