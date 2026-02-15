/**
 * CatSwitchScreen - Full-screen cat character gallery
 * Horizontal snap-to-center FlatList with backstories, unlock status, and selection
 */

import React, { useCallback, useRef, useMemo } from 'react';
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
} from 'react-native-reanimated';

import { CatAvatar } from '../components/Mascot/CatAvatar';
import { CAT_CHARACTERS, isCatUnlocked, getCatById } from '../components/Mascot/catCharacters';
import type { CatCharacter } from '../components/Mascot/catCharacters';
import { useSettingsStore } from '../stores/settingsStore';
import { useProgressStore } from '../stores/progressStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH * 0.75;
const CARD_SPACING = 16;
const SNAP_INTERVAL = CARD_WIDTH + CARD_SPACING;

function SelectButton({ isSelected, isUnlocked, onPress }: {
  isSelected: boolean;
  isUnlocked: boolean;
  onPress: () => void;
}): React.ReactElement {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = useCallback(() => {
    scale.value = withSpring(0.9, { damping: 15 }, () => {
      scale.value = withSpring(1, { damping: 10 });
    });
    onPress();
  }, [scale, onPress]);

  if (!isUnlocked) {
    return (
      <View style={[styles.selectButton, styles.selectButtonLocked]}>
        <MaterialCommunityIcons name="lock" size={18} color="#666" />
        <Text style={styles.selectButtonLockedText}>Locked</Text>
      </View>
    );
  }

  if (isSelected) {
    return (
      <View style={[styles.selectButton, styles.selectButtonSelected]}>
        <MaterialCommunityIcons name="check-circle" size={18} color="#FFFFFF" />
        <Text style={styles.selectButtonSelectedText}>Selected</Text>
      </View>
    );
  }

  return (
    <Animated.View style={animatedStyle}>
      <TouchableOpacity
        style={[styles.selectButton, styles.selectButtonAvailable]}
        onPress={handlePress}
        activeOpacity={0.8}
      >
        <Text style={styles.selectButtonAvailableText}>Select</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

function CatCard({ cat, isSelected, isUnlocked, onSelect }: {
  cat: CatCharacter;
  isSelected: boolean;
  isUnlocked: boolean;
  onSelect: (id: string) => void;
}): React.ReactElement {
  return (
    <View
      style={[
        styles.card,
        isSelected && { borderColor: '#DC143C', borderWidth: 2 },
        !isUnlocked && styles.cardLocked,
      ]}
    >
      {/* Avatar */}
      <View style={styles.avatarSection}>
        {isUnlocked ? (
          <CatAvatar catId={cat.id} size="large" showTooltipOnTap={false} />
        ) : (
          <View style={styles.lockedAvatarPlaceholder}>
            <MaterialCommunityIcons name="lock-outline" size={40} color="#555" />
            <Text style={styles.unlockLevelText}>Level {cat.unlockLevel}</Text>
          </View>
        )}
      </View>

      {/* Info */}
      <Text style={[styles.catName, !isUnlocked && { color: '#555' }]}>{cat.name}</Text>
      <View style={[styles.personalityBadge, { backgroundColor: isUnlocked ? cat.color + '33' : '#222' }]}>
        <Text style={[styles.personalityText, { color: isUnlocked ? cat.color : '#555' }]}>
          {cat.personality}
        </Text>
      </View>
      <Text style={[styles.musicSkill, !isUnlocked && { color: '#444' }]}>{cat.musicSkill}</Text>

      {/* Backstory */}
      <Text
        style={[styles.backstory, !isUnlocked && { color: '#333' }]}
        numberOfLines={4}
      >
        {cat.backstory}
      </Text>

      {/* Select button */}
      <SelectButton
        isSelected={isSelected}
        isUnlocked={isUnlocked}
        onPress={() => onSelect(cat.id)}
      />
    </View>
  );
}

export function CatSwitchScreen(): React.ReactElement {
  const navigation = useNavigation();
  const level = useProgressStore((s) => s.level);
  const selectedCatId = useSettingsStore((s) => s.selectedCatId);
  const setSelectedCatId = useSettingsStore((s) => s.setSelectedCatId);
  const flatListRef = useRef<FlatList>(null);

  // Find initial index for selected cat
  const initialIndex = useMemo(
    () => Math.max(0, CAT_CHARACTERS.findIndex((c) => c.id === selectedCatId)),
    [selectedCatId],
  );

  const handleSelect = useCallback((catId: string) => {
    if (!isCatUnlocked(catId, level)) return;
    setSelectedCatId(catId);
    // Update avatar emoji for backwards compat
    const cat = getCatById(catId);
    if (cat) {
      useSettingsStore.getState().setAvatarEmoji(cat.emoji);
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [level, setSelectedCatId]);

  const renderItem = useCallback(({ item }: { item: CatCharacter }) => (
    <CatCard
      cat={item}
      isSelected={selectedCatId === item.id}
      isUnlocked={isCatUnlocked(item.id, level)}
      onSelect={handleSelect}
    />
  ), [selectedCatId, level, handleSelect]);

  const keyExtractor = useCallback((item: CatCharacter) => item.id, []);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Choose Your Cat</Text>
        <View style={styles.headerSpacer} />
      </View>

      <Text style={styles.subtitle}>
        Swipe to browse {CAT_CHARACTERS.length} cats — unlock more by leveling up!
      </Text>

      {/* Horizontal gallery */}
      <FlatList
        ref={flatListRef}
        data={CAT_CHARACTERS}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
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
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0D0D',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  headerSpacer: {
    width: 40,
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 32,
  },
  listContent: {
    paddingHorizontal: (SCREEN_WIDTH - CARD_WIDTH) / 2,
    gap: CARD_SPACING,
    paddingVertical: 8,
  },
  card: {
    width: CARD_WIDTH,
    backgroundColor: '#1A1A1A',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    justifyContent: 'space-between',
  },
  cardLocked: {
    opacity: 0.6,
  },
  avatarSection: {
    marginBottom: 16,
  },
  lockedAvatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#1A1A1A',
    borderWidth: 2,
    borderColor: '#333',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  unlockLevelText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
    marginTop: 4,
  },
  catName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  personalityBadge: {
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  personalityText: {
    fontSize: 12,
    fontWeight: '700',
  },
  musicSkill: {
    fontSize: 14,
    color: '#B0B0B0',
    marginBottom: 12,
  },
  backstory: {
    fontSize: 13,
    color: '#999',
    lineHeight: 19,
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 12,
    minWidth: 140,
  },
  selectButtonAvailable: {
    backgroundColor: '#DC143C',
  },
  selectButtonAvailableText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  selectButtonSelected: {
    backgroundColor: '#2A2A2A',
    borderWidth: 1,
    borderColor: '#DC143C',
  },
  selectButtonSelectedText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  selectButtonLocked: {
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#333',
  },
  selectButtonLockedText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
});
