/**
 * CatStudioScreen — Accessory shop and dress-up for cat companions.
 *
 * Sections: 3D cat preview → category tabs → accessory grid → buy modal.
 * Uses glassmorphism + neon arcade visual language.
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  Modal,
  Platform,
  ScrollView,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';

import { GradientMeshBackground } from '../components/effects';
import { Cat3DCanvas } from '../components/Mascot/3d';
import { getCatById } from '../components/Mascot/catCharacters';
import {
  ACCESSORY_CATEGORIES,
  getAccessoriesByCategory,
  canEquipAccessory,
} from '../data/accessories';
import type { Accessory, AccessoryCategory, AccessoryRarity } from '../data/accessories';
import { useSettingsStore } from '../stores/settingsStore';
import { useCatEvolutionStore, stageFromXp } from '../stores/catEvolutionStore';
import { useGemStore } from '../stores/gemStore';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, RARITY, shadowGlow } from '../theme/tokens';

// ─── Rarity colors ───────────────────────────────────
const RARITY_COLORS: Record<AccessoryRarity, string> = {
  common: RARITY.common.borderColor,
  rare: RARITY.rare.borderColor,
  epic: RARITY.epic.borderColor,
  legendary: RARITY.legendary.borderColor,
};


// ─── Category Tabs ───────────────────────────────────
function CategoryTabs({
  active,
  onSelect,
}: {
  active: AccessoryCategory;
  onSelect: (c: AccessoryCategory) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.categoryRow}
    >
      {ACCESSORY_CATEGORIES.map((cat) => {
        const isActive = cat.key === active;
        return (
          <TouchableOpacity
            key={cat.key}
            onPress={() => {
              Haptics.selectionAsync();
              onSelect(cat.key);
            }}
            style={[
              styles.categoryPill,
              isActive && styles.categoryPillActive,
            ]}
          >
            <MaterialCommunityIcons
              name={cat.icon as never}
              size={16}
              color={isActive ? '#FFF' : COLORS.textSecondary}
            />
            <Text
              style={[
                styles.categoryLabel,
                isActive && styles.categoryLabelActive,
              ]}
            >
              {cat.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

// ─── Accessory Grid Item ─────────────────────────────
function AccessoryGridItem({
  accessory,
  isOwned,
  isEquipped,
  canEquip,
  onPress,
}: {
  accessory: Accessory;
  isOwned: boolean;
  isEquipped: boolean;
  canEquip: boolean;
  onPress: () => void;
}) {
  const rarityColor = RARITY_COLORS[accessory.rarity];

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.gridItem,
        { borderColor: isEquipped ? COLORS.primary : rarityColor },
        isEquipped && Platform.OS === 'ios' && shadowGlow(COLORS.primary, 10),
      ]}
      activeOpacity={0.7}
    >
      <MaterialCommunityIcons
        name={accessory.icon as never}
        size={32}
        color={isOwned ? rarityColor : COLORS.textMuted}
      />
      <Text style={styles.gridItemName} numberOfLines={1}>
        {accessory.name}
      </Text>

      {/* Status badges */}
      {isEquipped ? (
        <View style={[styles.badge, { backgroundColor: COLORS.primary }]}>
          <MaterialCommunityIcons name="check" size={10} color="#FFF" />
        </View>
      ) : !isOwned ? (
        <View style={[styles.badge, { backgroundColor: 'rgba(255,215,0,0.2)' }]}>
          <MaterialCommunityIcons name="diamond-stone" size={9} color={COLORS.gemGold} />
          <Text style={styles.badgeCost}>{accessory.gemCost}</Text>
        </View>
      ) : !canEquip ? (
        <View style={[styles.badge, { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
          <MaterialCommunityIcons name="lock" size={10} color={COLORS.textMuted} />
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

// ─── Buy Modal ───────────────────────────────────────
function BuyModal({
  visible,
  accessory,
  gems,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  accessory: Accessory | null;
  gems: number;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!accessory) return null;
  const rarityColor = RARITY_COLORS[accessory.rarity];
  const canAfford = gems >= accessory.gemCost;

  return (
    <Modal transparent visible={visible} animationType="fade" statusBarTranslucent>
      <View style={styles.modalOverlay}>
        <Animated.View
          entering={FadeIn.duration(200)}
          style={[styles.modalContent, { borderColor: rarityColor }]}
        >
          <MaterialCommunityIcons
            name={accessory.icon as never}
            size={56}
            color={rarityColor}
          />
          <Text style={styles.modalTitle}>{accessory.name}</Text>
          <Text style={[styles.modalRarity, { color: rarityColor }]}>
            {accessory.rarity.toUpperCase()}
          </Text>

          <View style={styles.modalCostRow}>
            <MaterialCommunityIcons name="diamond-stone" size={18} color={COLORS.gemGold} />
            <Text style={styles.modalCost}>{accessory.gemCost}</Text>
            <Text style={styles.modalBalance}>
              {'  '}(You have {gems})
            </Text>
          </View>

          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.modalCancel} onPress={onCancel}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.modalConfirm,
                !canAfford && styles.modalConfirmDisabled,
              ]}
              onPress={canAfford ? onConfirm : undefined}
              disabled={!canAfford}
            >
              <Text style={styles.modalConfirmText}>
                {canAfford ? 'Buy' : 'Not enough gems'}
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ─── Main Screen ─────────────────────────────────────
export function CatStudioScreen() {
  const navigation = useNavigation();
  const selectedCatId = useSettingsStore((s) => s.selectedCatId);
  const equippedAccessories = useSettingsStore((s) => s.equippedAccessories);
  const ownedAccessories = useSettingsStore((s) => s.ownedAccessories);
  const equipAccessory = useSettingsStore((s) => s.equipAccessory);
  const unequipAccessory = useSettingsStore((s) => s.unequipAccessory);
  const addOwnedAccessory = useSettingsStore((s) => s.addOwnedAccessory);

  const gems = useGemStore((s) => s.gems);
  const spendGems = useGemStore((s) => s.spendGems);

  const evolutionData = useCatEvolutionStore((s) => s.evolutionData);

  const [activeCategory, setActiveCategory] = useState<AccessoryCategory>('hats');
  const [buyTarget, setBuyTarget] = useState<Accessory | null>(null);

  const catData = getCatById(selectedCatId);
  const catXp = evolutionData[selectedCatId]?.xpAccumulated ?? 0;
  const currentStage = stageFromXp(catXp);

  const categoryItems = useMemo(
    () => getAccessoriesByCategory(activeCategory),
    [activeCategory],
  );

  const handleItemPress = useCallback(
    (accessory: Accessory) => {
      Haptics.selectionAsync();
      const isOwned = ownedAccessories.includes(accessory.id);
      const isEquipped = equippedAccessories[accessory.category] === accessory.id;
      const meetsStage = canEquipAccessory(accessory, currentStage);

      if (isEquipped) {
        unequipAccessory(accessory.category);
        return;
      }
      if (isOwned && meetsStage) {
        equipAccessory(accessory.category, accessory.id);
        return;
      }
      if (!isOwned) {
        setBuyTarget(accessory);
        return;
      }
      // Owned but doesn't meet stage — haptic feedback only
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    },
    [ownedAccessories, equippedAccessories, currentStage, equipAccessory, unequipAccessory],
  );

  const handleBuy = useCallback(() => {
    if (!buyTarget) return;
    const success = spendGems(buyTarget.gemCost, `accessory:${buyTarget.id}`);
    if (success) {
      addOwnedAccessory(buyTarget.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Auto-equip if stage requirement met
      if (canEquipAccessory(buyTarget, currentStage)) {
        equipAccessory(buyTarget.category, buyTarget.id);
      }
    }
    setBuyTarget(null);
  }, [buyTarget, spendGems, addOwnedAccessory, currentStage, equipAccessory]);

  const renderAccessory = useCallback(
    ({ item, index }: { item: Accessory; index: number }) => (
      <Animated.View entering={FadeInUp.delay(index * 40).duration(300)}>
        <AccessoryGridItem
          accessory={item}
          isOwned={ownedAccessories.includes(item.id)}
          isEquipped={equippedAccessories[item.category] === item.id}
          canEquip={canEquipAccessory(item, currentStage)}
          onPress={() => handleItemPress(item)}
        />
      </Animated.View>
    ),
    [ownedAccessories, equippedAccessories, currentStage, handleItemPress],
  );

  return (
    <SafeAreaView style={styles.container}>
      <GradientMeshBackground accent="catStudio" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="chevron-left" size={28} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Cat Studio</Text>
        <View style={styles.gemBadge}>
          <MaterialCommunityIcons name="diamond-stone" size={16} color={COLORS.gemGold} />
          <Text style={styles.gemCount}>{gems}</Text>
        </View>
      </View>

      {/* 3D Cat Preview */}
      <View style={styles.previewContainer}>
        <Cat3DCanvas
          catId={selectedCatId}
          pose="idle"
          size={180}
          evolutionStage={currentStage}
        />
        {catData && (
          <Text style={styles.catName}>{catData.name}</Text>
        )}
        <View style={styles.stageBadge}>
          <Text style={styles.stageText}>
            {currentStage.charAt(0).toUpperCase() + currentStage.slice(1)}
          </Text>
        </View>
      </View>

      {/* Category Tabs */}
      <CategoryTabs active={activeCategory} onSelect={setActiveCategory} />

      {/* Accessory Grid */}
      <FlatList
        data={categoryItems}
        renderItem={renderAccessory}
        keyExtractor={(item) => item.id}
        numColumns={3}
        contentContainerStyle={styles.gridContent}
        columnWrapperStyle={styles.gridRow}
        showsVerticalScrollIndicator={false}
      />

      {/* Buy Modal */}
      <BuyModal
        visible={buyTarget !== null}
        accessory={buyTarget}
        gems={gems}
        onConfirm={handleBuy}
        onCancel={() => setBuyTarget(null)}
      />
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  backBtn: {
    padding: SPACING.xs,
  },
  title: {
    ...TYPOGRAPHY.display.sm,
    color: COLORS.textPrimary,
    flex: 1,
    marginLeft: SPACING.sm,
  },
  gemBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.12)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
    gap: 4,
  },
  gemCount: {
    ...TYPOGRAPHY.button.md,
    color: COLORS.gemGold,
  },

  // Preview
  previewContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.md,
  },
  catName: {
    ...TYPOGRAPHY.heading.md,
    color: COLORS.textPrimary,
    marginTop: SPACING.sm,
  },
  stageBadge: {
    backgroundColor: 'rgba(220, 20, 60, 0.15)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.full,
    marginTop: SPACING.xs,
  },
  stageText: {
    ...TYPOGRAPHY.caption.lg,
    color: COLORS.primary,
    fontWeight: '600',
  },

  // Category tabs
  categoryRow: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  categoryPillActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  categoryLabel: {
    ...TYPOGRAPHY.button.sm,
    color: COLORS.textSecondary,
  },
  categoryLabelActive: {
    color: '#FFF',
  },

  // Grid
  gridContent: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.xxl,
  },
  gridRow: {
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  gridItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    backgroundColor: 'rgba(24, 24, 24, 0.75)',
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1.5,
    gap: 6,
  },
  gridItemName: {
    ...TYPOGRAPHY.caption.lg,
    color: COLORS.textPrimary,
    textAlign: 'center',
  },

  // Badges
  badge: {
    position: 'absolute',
    top: 6,
    right: 6,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.full,
    gap: 2,
  },
  badgeCost: {
    ...TYPOGRAPHY.caption.sm,
    color: COLORS.gemGold,
    fontWeight: '700',
  },

  // Buy modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: 280,
    backgroundColor: 'rgba(20, 20, 20, 0.95)',
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1.5,
    padding: SPACING.lg,
    alignItems: 'center',
    gap: SPACING.sm,
  },
  modalTitle: {
    ...TYPOGRAPHY.heading.lg,
    color: COLORS.textPrimary,
  },
  modalRarity: {
    ...TYPOGRAPHY.special.badge,
    letterSpacing: 2,
  },
  modalCostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: SPACING.sm,
  },
  modalCost: {
    ...TYPOGRAPHY.heading.md,
    color: COLORS.gemGold,
  },
  modalBalance: {
    ...TYPOGRAPHY.caption.lg,
    color: COLORS.textMuted,
  },
  modalActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.md,
    width: '100%',
  },
  modalCancel: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
  },
  modalCancelText: {
    ...TYPOGRAPHY.button.md,
    color: COLORS.textSecondary,
  },
  modalConfirm: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
  },
  modalConfirmDisabled: {
    backgroundColor: COLORS.textMuted,
    opacity: 0.5,
  },
  modalConfirmText: {
    ...TYPOGRAPHY.button.md,
    color: '#FFF',
  },
});
