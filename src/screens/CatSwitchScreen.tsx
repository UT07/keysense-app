/**
 * CatSwitchScreen - Subway Surfers-inspired character gallery
 * Full-screen character showcase with color-matched backgrounds, stage platform,
 * animated transitions, and burst selection effects.
 */

import React, { useCallback, useRef, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  Easing,
  FadeIn,
  FadeInDown,
  FadeInUp,
  interpolate,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

import { KeysieSvg } from '../components/Mascot/KeysieSvg';
import { CAT_CHARACTERS, isCatUnlocked, getCatById } from '../components/Mascot/catCharacters';
import type { CatCharacter } from '../components/Mascot/catCharacters';
import { useSettingsStore } from '../stores/settingsStore';
import { useProgressStore } from '../stores/progressStore';
import { COLORS, SPACING, BORDER_RADIUS } from '../theme/tokens';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH * 0.78;
const CARD_SPACING = 16;
const SNAP_INTERVAL = CARD_WIDTH + CARD_SPACING;

/** Animated burst particles on character select */
function SelectBurst({ color, active }: { color: string; active: boolean }): React.ReactElement | null {
  const particles = useMemo(() =>
    Array.from({ length: 8 }, (_, i) => ({
      id: i,
      angle: (i * 45) * (Math.PI / 180),
      delay: i * 40,
    })),
    [],
  );

  const progress = useSharedValue(0);

  useEffect(() => {
    if (active) {
      progress.value = 0;
      progress.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) });
    }
  }, [active, progress]);

  if (!active) return null;

  return (
    <View style={styles.burstContainer} pointerEvents="none">
      {particles.map((p) => (
        <BurstParticle key={p.id} angle={p.angle} color={color} progress={progress} />
      ))}
    </View>
  );
}

function BurstParticle({ angle, color, progress }: {
  angle: number;
  color: string;
  progress: Animated.SharedValue<number>;
}): React.ReactElement {
  const animStyle = useAnimatedStyle(() => {
    const dist = interpolate(progress.value, [0, 1], [0, 60]);
    const opacity = interpolate(progress.value, [0, 0.3, 1], [0, 1, 0]);
    const scale = interpolate(progress.value, [0, 0.5, 1], [0.3, 1.2, 0]);
    return {
      opacity,
      transform: [
        { translateX: Math.cos(angle) * dist },
        { translateY: Math.sin(angle) * dist },
        { scale },
      ],
    };
  });

  return (
    <Animated.View style={[styles.burstParticle, { backgroundColor: color }, animStyle]} />
  );
}

/** Stage platform beneath character */
function StagePlatform({ color }: { color: string }): React.ReactElement {
  return (
    <View style={styles.stageContainer}>
      {/* Main platform ellipse */}
      <View style={[styles.stagePlatform, { backgroundColor: color + '25' }]} />
      {/* Platform shadow */}
      <View style={[styles.stageShadow, { backgroundColor: color + '12' }]} />
      {/* Shine line */}
      <View style={[styles.stageShine, { backgroundColor: color + '40' }]} />
    </View>
  );
}

/** Animated "Select" button with spring */
function SelectButton({ isSelected, isUnlocked, onPress, color, testID }: {
  isSelected: boolean;
  isUnlocked: boolean;
  onPress: () => void;
  color: string;
  testID?: string;
}): React.ReactElement {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = useCallback(() => {
    scale.value = withSequence(
      withTiming(0.88, { duration: 80 }),
      withSpring(1, { damping: 8, stiffness: 200 }),
    );
    onPress();
  }, [scale, onPress]);

  if (!isUnlocked) {
    return (
      <View style={[styles.selectButton, styles.selectButtonLocked]}>
        <MaterialCommunityIcons name="lock" size={18} color={COLORS.textMuted} />
        <Text style={styles.selectButtonLockedText}>Locked</Text>
      </View>
    );
  }

  if (isSelected) {
    return (
      <Animated.View entering={FadeIn.duration(200)}>
        <View style={[styles.selectButton, styles.selectButtonSelected, { borderColor: color }]}>
          <MaterialCommunityIcons name="check-circle" size={18} color={color} />
          <Text style={[styles.selectButtonSelectedText, { color }]}>Selected</Text>
        </View>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={animatedStyle}>
      <TouchableOpacity
        style={[styles.selectButton, { backgroundColor: color }]}
        onPress={handlePress}
        activeOpacity={0.85}
        testID={testID}
      >
        <Text style={styles.selectButtonText}>Select</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

/** Character card with full visual identity */
function CatCard({ cat, isSelected, isUnlocked, onSelect, index }: {
  cat: CatCharacter;
  isSelected: boolean;
  isUnlocked: boolean;
  onSelect: (id: string) => void;
  index: number;
}): React.ReactElement {
  const [showBurst, setShowBurst] = React.useState(false);

  const handleSelect = useCallback(() => {
    if (!isUnlocked) return;
    setShowBurst(true);
    onSelect(cat.id);
    setTimeout(() => setShowBurst(false), 700);
  }, [cat.id, isUnlocked, onSelect]);

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 60).springify().damping(14)}
      style={[
        styles.card,
        isSelected && { borderColor: cat.color + '80', borderWidth: 2 },
        !isUnlocked && styles.cardLocked,
      ]}
    >
      {/* Background gradient tinted to cat's color */}
      <LinearGradient
        colors={[cat.color + '15', 'transparent']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.6 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Character showcase area */}
      <View style={styles.showcaseArea}>
        {isUnlocked ? (
          <View style={styles.characterDisplay}>
            <SelectBurst color={cat.color} active={showBurst} />
            <KeysieSvg
              mood={isSelected ? 'celebrating' : 'happy'}
              size="large"
              accentColor={cat.color}
              pixelSize={140}
              visuals={cat.visuals}
            />
          </View>
        ) : (
          <View style={styles.lockedCharacter}>
            <View style={[styles.lockedSilhouette, { backgroundColor: cat.color + '10' }]}>
              <MaterialCommunityIcons name="lock-outline" size={48} color={COLORS.textMuted} />
            </View>
            <View style={[styles.unlockBadge, { backgroundColor: cat.color + '30' }]}>
              <MaterialCommunityIcons name="star" size={12} color={cat.color} />
              <Text style={[styles.unlockBadgeText, { color: cat.color }]}>Level {cat.unlockLevel}</Text>
            </View>
          </View>
        )}

        {/* Stage platform */}
        <StagePlatform color={isUnlocked ? cat.color : COLORS.textMuted} />
      </View>

      {/* Cat info */}
      <View style={styles.infoSection}>
        <Text style={[styles.catName, !isUnlocked && { color: COLORS.textMuted }]}>
          {cat.name}
        </Text>

        <View style={[styles.personalityBadge, { backgroundColor: isUnlocked ? cat.color + '25' : COLORS.surface }]}>
          <Text style={[styles.personalityText, { color: isUnlocked ? cat.color : COLORS.textMuted }]}>
            {cat.personality}
          </Text>
        </View>

        <Text style={[styles.musicSkill, !isUnlocked && { color: COLORS.cardBorder }]}>
          {cat.musicSkill}
        </Text>

        <Text
          style={[styles.backstory, !isUnlocked && { color: COLORS.cardBorder }]}
          numberOfLines={3}
        >
          {cat.backstory}
        </Text>
      </View>

      {/* Select button */}
      <SelectButton
        isSelected={isSelected}
        isUnlocked={isUnlocked}
        onPress={handleSelect}
        color={cat.color}
        testID={`cat-switch-select-${cat.id}`}
      />
    </Animated.View>
  );
}

/** Navigation dots showing current position */
function PaginationDots({ total, currentIndex, cats }: {
  total: number;
  currentIndex: number;
  cats: CatCharacter[];
}): React.ReactElement {
  return (
    <View style={styles.paginationContainer}>
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={[
            styles.paginationDot,
            {
              backgroundColor: i === currentIndex ? cats[i].color : COLORS.cardBorder,
              width: i === currentIndex ? 20 : 8,
            },
          ]}
        />
      ))}
    </View>
  );
}

export function CatSwitchScreen(): React.ReactElement {
  const navigation = useNavigation();
  const level = useProgressStore((s) => s.level);
  const selectedCatId = useSettingsStore((s) => s.selectedCatId);
  const setSelectedCatId = useSettingsStore((s) => s.setSelectedCatId);
  const flatListRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = React.useState(0);

  const initialIndex = useMemo(
    () => Math.max(0, CAT_CHARACTERS.findIndex((c) => c.id === selectedCatId)),
    [selectedCatId],
  );

  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex]);

  const handleSelect = useCallback((catId: string) => {
    if (!isCatUnlocked(catId, level)) return;
    setSelectedCatId(catId);
    const cat = getCatById(catId);
    if (cat) {
      useSettingsStore.getState().setAvatarEmoji(cat.emoji);
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [level, setSelectedCatId]);

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: Array<{ index: number | null }> }) => {
    if (viewableItems.length > 0 && viewableItems[0].index != null) {
      setCurrentIndex(viewableItems[0].index);
    }
  }).current;

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const renderItem = useCallback(({ item, index }: { item: CatCharacter; index: number }) => (
    <CatCard
      cat={item}
      isSelected={selectedCatId === item.id}
      isUnlocked={isCatUnlocked(item.id, level)}
      onSelect={handleSelect}
      index={index}
    />
  ), [selectedCatId, level, handleSelect]);

  const keyExtractor = useCallback((item: CatCharacter) => item.id, []);

  const currentCat = CAT_CHARACTERS[currentIndex] ?? CAT_CHARACTERS[0];

  return (
    <View style={styles.container} testID="cat-switch-screen">
      {/* Dynamic background gradient matching current cat */}
      <LinearGradient
        colors={[currentCat.color + '18', COLORS.background, COLORS.background]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.4 }}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            testID="cat-switch-back"
          >
            <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Choose Your Cat</Text>
            <Text style={styles.headerSubtitle}>
              {CAT_CHARACTERS.filter((c) => isCatUnlocked(c.id, level)).length} of {CAT_CHARACTERS.length} unlocked
            </Text>
          </View>
          <View style={styles.headerSpacer} />
        </Animated.View>

        {/* Character gallery */}
        <FlatList
          ref={flatListRef}
          data={CAT_CHARACTERS}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          testID="cat-switch-list"
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={SNAP_INTERVAL}
          decelerationRate="fast"
          contentContainerStyle={styles.listContent}
          initialScrollIndex={initialIndex}
          getItemLayout={(_data, index) => ({
            length: SNAP_INTERVAL,
            offset: SNAP_INTERVAL * index,
            index,
          })}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
        />

        {/* Pagination dots */}
        <Animated.View entering={FadeInUp.delay(300).duration(400)}>
          <PaginationDots
            total={CAT_CHARACTERS.length}
            currentIndex={currentIndex}
            cats={CAT_CHARACTERS}
          />
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  headerSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  headerSpacer: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: (SCREEN_WIDTH - CARD_WIDTH) / 2,
    gap: CARD_SPACING,
    paddingVertical: SPACING.sm,
  },
  card: {
    width: CARD_WIDTH,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    paddingBottom: SPACING.lg,
  },
  cardLocked: {
    opacity: 0.65,
  },

  // Character showcase
  showcaseArea: {
    alignItems: 'center',
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.sm,
  },
  characterDisplay: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  lockedCharacter: {
    alignItems: 'center',
  },
  lockedSilhouette: {
    width: 140,
    height: 140,
    borderRadius: 70,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.cardBorder,
    borderStyle: 'dashed',
  },
  unlockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.sm,
    marginTop: SPACING.sm,
  },
  unlockBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },

  // Stage platform
  stageContainer: {
    alignItems: 'center',
    marginTop: -8,
  },
  stagePlatform: {
    width: 160,
    height: 16,
    borderRadius: 80,
  },
  stageShadow: {
    width: 180,
    height: 8,
    borderRadius: 90,
    marginTop: -4,
  },
  stageShine: {
    width: 80,
    height: 2,
    borderRadius: 1,
    marginTop: -10,
  },

  // Burst particles
  burstContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  burstParticle: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  // Info section
  infoSection: {
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
  },
  catName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  personalityBadge: {
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
    marginBottom: SPACING.sm,
  },
  personalityText: {
    fontSize: 12,
    fontWeight: '700',
  },
  musicSkill: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  backstory: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 19,
    textAlign: 'center',
    marginBottom: SPACING.md,
    paddingHorizontal: SPACING.sm,
  },

  // Select button
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 36,
    borderRadius: BORDER_RADIUS.md,
    minWidth: 150,
    alignSelf: 'center',
  },
  selectButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  selectButtonSelected: {
    backgroundColor: 'transparent',
    borderWidth: 2,
  },
  selectButtonSelectedText: {
    fontSize: 16,
    fontWeight: '600',
  },
  selectButtonLocked: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  selectButtonLockedText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textMuted,
  },

  // Pagination
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingBottom: SPACING.md,
  },
  paginationDot: {
    height: 8,
    borderRadius: 4,
  },
});
