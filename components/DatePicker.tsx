import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from "react-native";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { Calendar } from "lucide-react-native";

interface DatePickerProps {
  value: Date;
  onChange: (date: Date) => void;
}

export default function DatePicker({ value, onChange }: DatePickerProps) {
  const [showPicker, setShowPicker] = useState(false);

  const handleChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowPicker(false);
    if (selectedDate) onChange(selectedDate);
  };

  const formattedDate = value.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <View style={styles.container}>
      {/* Date Display with Calendar Icon */}
      <TouchableOpacity
        style={styles.dateButton}
        onPress={() => setShowPicker(true)}
        accessibilityLabel="Open date picker"
      >
        <Calendar size={20} color="#6b7280" style={{ marginRight: 8 }} />
        <Text style={styles.dateText}>{formattedDate}</Text>
      </TouchableOpacity>

      {/* Date Picker for Each Platform */}
      {Platform.OS === "web" ? (
        showPicker && (
          <input
            type="date"
            autoFocus
            value={value.toISOString().split("T")[0]}
            onChange={(e) => {
              const newDate = new Date(e.target.value);
              onChange(newDate);
              setShowPicker(false);
            }}
            style={styles.webInput as any}
          />
        )
      ) : (
        showPicker && (
          <DateTimePicker
            value={value}
            mode="date"
            display="calendar"
            onChange={handleChange}
          />
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    padding: 10,
  },
  dateButton: {
    flexDirection: "row",
    alignItems: "center",
  },
  dateText: {
    fontSize: 16,
    color: "#111827",
    fontWeight: "500",
  },
  webInput: {
    marginTop: 8,
    padding: 8,
    fontSize: 16,
    borderRadius: 6,
    border: "1px solid #d1d5db",
  } as any,
});
