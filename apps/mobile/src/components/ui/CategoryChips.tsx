import React from "react";
import { ScrollView, TouchableOpacity, Text, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, categoryColors, categoryIcons, radii } from "@/theme";

interface CategoryChipsProps {
  categories: string[];
  selected: string;
  onSelect: (category: string) => void;
}

export function CategoryChips({ categories, selected, onSelect }: CategoryChipsProps) {
  const all = ["All", ...categories];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {all.map((cat) => {
        const isSelected = selected === cat;
        const rawKey = cat.toLowerCase().replace(/ /g, "_");
        const catColor = cat === "All" ? colors.accent : (categoryColors[rawKey] ?? colors.accent);
        const iconName = cat === "All"
          ? "grid-outline"
          : ((categoryIcons[rawKey] ?? "ellipse-outline") as keyof typeof Ionicons.glyphMap);

        return (
          <TouchableOpacity
            key={cat}
            onPress={() => onSelect(cat)}
            activeOpacity={0.78}
            style={[
              styles.chip,
              isSelected
                ? { backgroundColor: catColor, borderColor: catColor }
                : { backgroundColor: catColor + "12", borderColor: catColor + "35" },
            ]}
          >
            <Ionicons
              name={iconName}
              size={13}
              color={isSelected ? "#0C0F1A" : catColor}
            />
            <Text
              style={[
                styles.label,
                { color: isSelected ? "#0C0F1A" : catColor },
              ]}
            >
              {cat}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    gap: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "capitalize",
    letterSpacing: 0.1,
  },
});
