/**
 * EditTilesSheet
 *
 * Bottom sheet for customizing the dashboard's Health Data tile grid.
 * Two sections:
 *   1. Enabled tiles — drag-and-drop reorder; tap minus to remove.
 *   2. Available tiles — tap plus to append to the end of the order.
 *
 * State changes are forwarded to the parent via `onChange` (which talks to
 * `useDashboardTiles` for optimistic + persisted updates). Closing the sheet
 * does not "save" — every change is already persisted.
 */
import React, { useMemo } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Pressable,
} from "react-native";
import DraggableFlatList, {
  type RenderItemParams,
  ScaleDecorator,
} from "react-native-draggable-flatlist";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, radii } from "@/theme";
import {
  ALL_TILE_IDS,
  TILE_CATALOGUE,
  type TileId,
} from "@/components/dashboard/healthTiles";

interface EditTilesSheetProps {
  visible: boolean;
  onClose: () => void;
  tileIds: TileId[];
  onChange: (next: TileId[] | ((prev: TileId[]) => TileId[])) => void;
}

export function EditTilesSheet({
  visible,
  onClose,
  tileIds,
  onChange,
}: EditTilesSheetProps) {
  const enabledSet = useMemo(() => new Set(tileIds), [tileIds]);
  const availableIds = useMemo(
    () => ALL_TILE_IDS.filter((id) => !enabledSet.has(id)),
    [enabledSet]
  );

  const handleRemove = (id: TileId) => {
    onChange((prev) => prev.filter((p) => p !== id));
  };

  const handleAdd = (id: TileId) => {
    onChange((prev) => [...prev, id]);
  };

  const renderEnabled = ({ item, drag, isActive }: RenderItemParams<TileId>) => {
    const def = TILE_CATALOGUE[item];
    if (!def) return null;
    return (
      <ScaleDecorator>
        <Pressable
          onLongPress={drag}
          delayLongPress={150}
          style={[styles.row, isActive && styles.rowActive]}
        >
          <View style={[styles.iconBox, { backgroundColor: def.color + "18" }]}>
            <Ionicons name={def.icon} size={16} color={def.color} />
          </View>
          <View style={styles.body}>
            <Text style={styles.title}>{def.title}</Text>
            <Text style={styles.sub} numberOfLines={1}>
              {def.sub}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => handleRemove(item)}
            style={styles.removeBtn}
            hitSlop={8}
          >
            <Ionicons name="remove-circle" size={22} color={colors.destructive} />
          </TouchableOpacity>
          <View style={styles.dragHandle}>
            <Ionicons name="reorder-three" size={22} color={colors.textTertiary} />
          </View>
        </Pressable>
      </ScaleDecorator>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      />
      <View style={styles.sheet}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <View style={styles.handle} />
          <View style={styles.headerRow}>
            <Text style={styles.heading}>Edit dashboard tiles</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <Text style={styles.subhead}>
            Long-press a tile to drag · tap minus to remove · tap plus to add
          </Text>

          <Text style={styles.sectionLabel}>Enabled</Text>
          <View style={styles.dragArea}>
            <DraggableFlatList
              data={tileIds}
              keyExtractor={(id) => id}
              renderItem={renderEnabled}
              onDragEnd={({ data }) => onChange(data)}
              activationDistance={6}
            />
          </View>

          <Text style={styles.sectionLabel}>Available</Text>
          <ScrollView style={styles.availableScroll}>
            {availableIds.map((id) => {
              const def = TILE_CATALOGUE[id];
              if (!def) return null;
              return (
                <Pressable
                  key={id}
                  style={styles.row}
                  onPress={() => handleAdd(id)}
                >
                  <View style={[styles.iconBox, { backgroundColor: def.color + "18" }]}>
                    <Ionicons name={def.icon} size={16} color={def.color} />
                  </View>
                  <View style={styles.body}>
                    <Text style={styles.title}>{def.title}</Text>
                    <Text style={styles.sub} numberOfLines={1}>
                      {def.sub}
                    </Text>
                  </View>
                  <View style={styles.addBtn}>
                    <Ionicons name="add-circle" size={22} color={colors.accent} />
                  </View>
                </Pressable>
              );
            })}
            {availableIds.length === 0 && (
              <Text style={styles.emptyText}>All tiles are enabled.</Text>
            )}
          </ScrollView>
        </GestureHandlerRootView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)" },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "85%",
    backgroundColor: colors.card,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: radii.full,
    alignSelf: "center",
    marginBottom: spacing.md,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  heading: { color: colors.textPrimary, fontSize: 18, fontWeight: "700" },
  subhead: {
    color: colors.textTertiary,
    fontSize: 12,
    marginBottom: spacing.md,
  },
  sectionLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  dragArea: {
    flex: 1,
    minHeight: 120,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    paddingVertical: 4,
  },
  availableScroll: {
    maxHeight: 220,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    paddingVertical: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  rowActive: {
    backgroundColor: colors.cardAlt,
    borderRadius: radii.md,
  },
  iconBox: {
    width: 34,
    height: 34,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { flex: 1, gap: 1 },
  title: { color: colors.textPrimary, fontSize: 14, fontWeight: "600" },
  sub: { color: colors.textTertiary, fontSize: 11 },
  removeBtn: { padding: 4 },
  addBtn: { padding: 4 },
  dragHandle: { padding: 2 },
  emptyText: {
    color: colors.textTertiary,
    fontSize: 12,
    textAlign: "center",
    paddingVertical: spacing.md,
  },
});
