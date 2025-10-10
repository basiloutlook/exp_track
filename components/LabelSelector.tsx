import { useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import { storageService } from "@/utils/storage";

interface LabelSelectorProps {
  value: string[];
  onChange: (labels: string[]) => void;
}

const defaultSuggestions = [
  "Mampad",
  "Makkaraparamb",
  "Monthly",
  "Non-Essential",
  "Emergency",
  "Treat"
];

export default function LabelSelector({ value, onChange }: LabelSelectorProps) {
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>(defaultSuggestions);

  useEffect(() => {
    (async () => {
      const recent = await storageService.getRecentLabels();
      if (recent.length > 0) {
        // Combine recent + default (unique)
        const unique = Array.from(new Set([...recent, ...defaultSuggestions]));
        setSuggestions(unique);
      }
    })();
  }, []);

  const addLabel = async (label: string) => {
    if (!label.trim() || value.includes(label)) return;
    const updated = [...value, label];
    onChange(updated);
    await storageService.saveLabel(label); // ✅ remember label for future
    setInput("");
  };

  const removeLabel = (label: string) => {
    onChange(value.filter((l) => l !== label));
  };

  return (
    <View style={styles.container}>
      <TextInput
        value={input}
        onChangeText={setInput}
        onSubmitEditing={() => addLabel(input)}
        placeholder="Add label..."
        style={styles.input}
      />

      <View style={styles.selectedContainer}>
        {value.map((label) => (
          <TouchableOpacity
            key={label}
            style={styles.selectedChip}
            onPress={() => removeLabel(label)}
          >
            <Text style={styles.chipText}>{label} ✕</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.suggestionContainer}>
        {suggestions.map((s) => (
          <TouchableOpacity
            key={s}
            onPress={() => addLabel(s)}
            style={[
              styles.suggestionChip,
              value.includes(s) && styles.suggestionChipActive,
            ]}
          >
            <Text
              style={[
                styles.suggestionText,
                value.includes(s) && styles.suggestionTextActive,
              ]}
            >
              {s}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 8 },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    padding: 8,
    fontSize: 14,
  },
  selectedContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 8,
    gap: 6,
  },
  selectedChip: {
    backgroundColor: "#dbeafe",
    borderRadius: 16,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  chipText: { fontSize: 13, color: "#1e3a8a" },
  suggestionContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
  },
  suggestionChip: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 16,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  suggestionChipActive: {
    backgroundColor: "#2563eb",
    borderColor: "#2563eb",
  },
  suggestionText: { fontSize: 13, color: "#374151" },
  suggestionTextActive: { color: "white" },
});
