import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
} from "react-native";
import {
  BottomSheetModal,
  BottomSheetView,
  type BottomSheetModal as BottomSheetModalType,
  BottomSheetBackdrop,
} from "@gorhom/bottom-sheet";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { useAction, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { colors, spacing, radii } from "@/theme";
import { useNutrition } from "@/context/NutritionContext";
import { useRevenueCat } from "@/context/RevenueCatContext";
import { track } from "@/lib/analytics";

type RecognizedItem = {
  name: string;
  quantity: number;
  unit: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  confidence: number;
};

const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"] as const;
type MealType = (typeof MEAL_TYPES)[number];

type Props = {
  onClose?: () => void;
  initialMealType?: MealType;
};

export const FoodCameraSheet = React.forwardRef<BottomSheetModalType, Props>(
  ({ onClose, initialMealType = "lunch" }, ref) => {
    const snapPoints = useMemo(() => ["88%"], []);
    const [imageUri, setImageUri] = useState<string | null>(null);
    const [items, setItems] = useState<RecognizedItem[]>([]);
    const [photoId, setPhotoId] = useState<Id<"foodPhotos"> | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [mealType, setMealType] = useState<MealType>(initialMealType);
    const [error, setError] = useState<string | null>(null);

    const { addFoodEntry } = useNutrition();
    const { isProUser, presentPaywall } = useRevenueCat();
    const recognize = useAction(api.foodVision.recognizeFromPhoto);
    const getUploadUrl = useMutation(api.foodVision.getUploadUrl);

    const reset = useCallback(() => {
      setImageUri(null);
      setItems([]);
      setPhotoId(null);
      setError(null);
    }, []);

    const pickFromCamera = useCallback(async () => {
      reset();
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Camera permission needed", "Allow camera access in Settings.");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        quality: 0.85,
        base64: false,
        allowsEditing: false,
        mediaTypes: ImagePicker.MediaTypeOptions?.Images,
      });
      if (result.canceled || !result.assets?.[0]) return;
      setImageUri(result.assets[0].uri);
    }, [reset]);

    const pickFromLibrary = useCallback(async () => {
      reset();
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return;
      const result = await ImagePicker.launchImageLibraryAsync({
        quality: 0.85,
        allowsEditing: false,
        mediaTypes: ImagePicker.MediaTypeOptions?.Images,
      });
      if (result.canceled || !result.assets?.[0]) return;
      setImageUri(result.assets[0].uri);
    }, [reset]);

    const analyze = useCallback(async () => {
      if (!imageUri) return;
      if (!isProUser) {
        Alert.alert("Pro feature", "Photo recognition is part of Elysia Pro.", [
          { text: "Cancel", style: "cancel" },
          { text: "Upgrade", onPress: presentPaywall },
        ]);
        return;
      }
      setIsAnalyzing(true);
      setError(null);
      try {
        const uploadUrl = await getUploadUrl({});
        const response = await fetch(imageUri);
        const blob = await response.blob();
        const uploadRes = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": blob.type || "image/jpeg" },
          body: blob,
        });
        if (!uploadRes.ok) throw new Error(`Upload failed (${uploadRes.status})`);
        const { storageId } = (await uploadRes.json()) as { storageId: string };
        const result = await recognize({ storageId, isProUser });
        setItems(result.items);
        setPhotoId(result.photoId as Id<"foodPhotos">);
        track("food_photo_recognised", { items: result.items.length });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Recognition failed");
      } finally {
        setIsAnalyzing(false);
      }
    }, [imageUri, isProUser, presentPaywall, getUploadUrl, recognize]);

    const updateItem = useCallback(<K extends keyof RecognizedItem>(idx: number, key: K, value: RecognizedItem[K]) => {
      setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [key]: value } : it)));
    }, []);

    const removeItem = useCallback((idx: number) => {
      setItems((prev) => prev.filter((_, i) => i !== idx));
    }, []);

    const totals = useMemo(
      () =>
        items.reduce(
          (acc, it) => ({
            calories: acc.calories + (Number(it.calories) || 0),
            proteinG: acc.proteinG + (Number(it.proteinG) || 0),
            carbsG: acc.carbsG + (Number(it.carbsG) || 0),
            fatG: acc.fatG + (Number(it.fatG) || 0),
          }),
          { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 }
        ),
      [items]
    );

    const logAll = useCallback(async () => {
      if (items.length === 0) return;
      try {
        for (const it of items) {
          await addFoodEntry({
            name: it.name,
            mealType,
            calories: Math.round(it.calories),
            proteinG: Math.round(it.proteinG),
            carbsG: Math.round(it.carbsG),
            fatG: Math.round(it.fatG),
            quantity: it.quantity,
            unit: it.unit,
            confidence: it.confidence,
            photoId: photoId ?? undefined,
          });
        }
        reset();
        if (typeof ref === "object" && ref?.current) ref.current.dismiss();
        onClose?.();
      } catch (e) {
        Alert.alert("Save failed", (e as Error).message);
      }
    }, [items, mealType, photoId, addFoodEntry, ref, reset, onClose]);

    return (
      <BottomSheetModal
        ref={ref}
        snapPoints={snapPoints}
        backdropComponent={(p) => (
          <BottomSheetBackdrop {...p} appearsOnIndex={0} disappearsOnIndex={-1} />
        )}
        backgroundStyle={styles.bg}
        handleIndicatorStyle={styles.handle}
      >
        <BottomSheetView style={styles.body}>
          <View style={styles.headerRow}>
            <Text style={styles.headerTitle}>AI food camera</Text>
            <TouchableOpacity onPress={() => (typeof ref === "object" && ref?.current?.dismiss())}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.mealTabs}>
            {MEAL_TYPES.map((m) => (
              <TouchableOpacity
                key={m}
                onPress={() => setMealType(m)}
                style={[styles.mealTab, mealType === m && styles.mealTabActive]}
              >
                <Text style={[styles.mealTabText, mealType === m && styles.mealTabTextActive]}>
                  {m[0]!.toUpperCase() + m.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {imageUri ? (
            <View style={styles.previewWrap}>
              <Image source={{ uri: imageUri }} style={styles.preview} />
            </View>
          ) : (
            <View style={styles.captureRow}>
              <TouchableOpacity style={styles.captureBtn} onPress={pickFromCamera}>
                <Ionicons name="camera-outline" size={22} color={colors.textPrimary} />
                <Text style={styles.captureLabel}>Take photo</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.captureBtn} onPress={pickFromLibrary}>
                <Ionicons name="image-outline" size={22} color={colors.textPrimary} />
                <Text style={styles.captureLabel}>From library</Text>
              </TouchableOpacity>
            </View>
          )}

          {imageUri && items.length === 0 && (
            <TouchableOpacity
              style={[styles.primaryBtn, isAnalyzing && styles.btnDisabled]}
              onPress={analyze}
              disabled={isAnalyzing}
            >
              {isAnalyzing ? (
                <ActivityIndicator color={colors.textPrimary} />
              ) : (
                <Text style={styles.primaryBtnLabel}>Analyse photo</Text>
              )}
            </TouchableOpacity>
          )}

          {error && <Text style={styles.errorText}>{error}</Text>}

          {items.length > 0 && (
            <ScrollView style={styles.itemsList} contentContainerStyle={{ paddingBottom: 24 }}>
              {items.map((it, idx) => (
                <View key={`${it.name}-${idx}`} style={styles.itemCard}>
                  <View style={styles.itemHead}>
                    <TextInput
                      style={styles.itemName}
                      value={it.name}
                      onChangeText={(t) => updateItem(idx, "name", t)}
                    />
                    <TouchableOpacity onPress={() => removeItem(idx)}>
                      <Ionicons name="trash-outline" size={18} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.itemRow}>
                    <NumField
                      label="Qty"
                      value={it.quantity}
                      onChange={(v) => updateItem(idx, "quantity", v)}
                    />
                    <NumField
                      label="kcal"
                      value={it.calories}
                      onChange={(v) => updateItem(idx, "calories", v)}
                    />
                    <NumField
                      label="P"
                      value={it.proteinG}
                      onChange={(v) => updateItem(idx, "proteinG", v)}
                    />
                    <NumField
                      label="C"
                      value={it.carbsG}
                      onChange={(v) => updateItem(idx, "carbsG", v)}
                    />
                    <NumField label="F" value={it.fatG} onChange={(v) => updateItem(idx, "fatG", v)} />
                  </View>
                  <Text style={styles.itemConf}>
                    {Math.round(it.confidence * 100)}% confidence · {it.unit}
                  </Text>
                </View>
              ))}
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>Total</Text>
                <Text style={styles.totalsVal}>
                  {Math.round(totals.calories)} kcal · {Math.round(totals.proteinG)}P /
                  {Math.round(totals.carbsG)}C / {Math.round(totals.fatG)}F
                </Text>
              </View>
              <TouchableOpacity style={styles.primaryBtn} onPress={logAll}>
                <Text style={styles.primaryBtnLabel}>Log {items.length} item{items.length === 1 ? "" : "s"}</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </BottomSheetView>
      </BottomSheetModal>
    );
  }
);

FoodCameraSheet.displayName = "FoodCameraSheet";

function NumField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <View style={styles.numField}>
      <Text style={styles.numLabel}>{label}</Text>
      <TextInput
        style={styles.numInput}
        keyboardType="numeric"
        value={String(value)}
        onChangeText={(t) => onChange(Number(t.replace(",", ".")) || 0)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { backgroundColor: colors.surface },
  handle: { backgroundColor: colors.textSecondary, width: 40 },
  body: { flex: 1, padding: spacing.md },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  headerTitle: { color: colors.textPrimary, fontSize: 17, fontWeight: "700" },
  mealTabs: {
    flexDirection: "row",
    gap: 6,
    marginBottom: spacing.md,
  },
  mealTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  mealTabActive: { backgroundColor: colors.accent },
  mealTabText: { color: colors.textSecondary, fontSize: 13, fontWeight: "600" },
  mealTabTextActive: { color: "#0B1020" },
  previewWrap: {
    width: "100%",
    aspectRatio: 4 / 3,
    borderRadius: radii.lg,
    overflow: "hidden",
    marginBottom: spacing.md,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  preview: { width: "100%", height: "100%" },
  captureRow: { flexDirection: "row", gap: 12, marginBottom: spacing.md },
  captureBtn: {
    flex: 1,
    paddingVertical: 22,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: radii.md,
    alignItems: "center",
    gap: 6,
  },
  captureLabel: { color: colors.textPrimary, fontSize: 13, fontWeight: "600" },
  primaryBtn: {
    backgroundColor: colors.accent,
    paddingVertical: 14,
    borderRadius: radii.md,
    alignItems: "center",
    marginTop: spacing.sm,
  },
  btnDisabled: { opacity: 0.6 },
  primaryBtnLabel: { color: "#0B1020", fontSize: 15, fontWeight: "700" },
  errorText: { color: colors.destructive, marginTop: 8, fontSize: 13 },
  itemsList: { flex: 1, marginTop: spacing.sm },
  itemCard: {
    backgroundColor: "rgba(255,255,255,0.04)",
    padding: 12,
    borderRadius: radii.md,
    marginBottom: 8,
  },
  itemHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  itemName: { flex: 1, color: colors.textPrimary, fontSize: 15, fontWeight: "600" },
  itemRow: { flexDirection: "row", gap: 8 },
  numField: { flex: 1 },
  numLabel: { color: colors.textTertiary, fontSize: 11 },
  numInput: {
    color: colors.textPrimary,
    fontSize: 13,
    paddingVertical: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.15)",
  },
  itemConf: { color: colors.textTertiary, fontSize: 11, marginTop: 6 },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 6,
  },
  totalsLabel: { color: colors.textSecondary, fontSize: 13 },
  totalsVal: { color: colors.textPrimary, fontSize: 13, fontWeight: "600" },
});
