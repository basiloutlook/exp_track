import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Modal,
  Pressable,
} from 'react-native';
import { Calendar } from 'lucide-react-native';

interface DatePickerProps {
  value: Date;
  onChange: (date: Date) => void;
}

export default function DatePicker({ value, onChange }: DatePickerProps) {
  const [showPicker, setShowPicker] = useState(false);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const handleDateChange = (days: number) => {
    const newDate = new Date(value);
    newDate.setDate(newDate.getDate() + days);
    onChange(newDate);
  };

  const handleSelectDate = (date: Date) => {
    onChange(date);
    setShowPicker(false);
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.dateDisplay} onPress={() => setShowPicker(true)} accessibilityLabel="Open calendar">
        <Calendar size={20} color="#6b7280" style={styles.icon} />
        <Text style={styles.dateText}>{formatDate(value)}</Text>
      </TouchableOpacity>
      <View style={styles.controls}>
        <TouchableOpacity
          style={styles.controlButton}
          onPress={() => handleDateChange(-1)}>
          <Text style={styles.controlButtonText}>← Prev</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.controlButton}
          onPress={() => onChange(new Date())}>
          <Text style={styles.controlButtonText}>Today</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.controlButton}
          onPress={() => handleDateChange(1)}>
          <Text style={styles.controlButtonText}>Next →</Text>
        </TouchableOpacity>
      </View>

      {/* Platform-specific picker modal/input */}
      {Platform.OS === 'web' ? (
        showPicker ? (
          // Render a visible date input on web so browser picker reliably opens
          <input
            type="date"
            value={new Date(value).toISOString().slice(0, 10)}
            onChange={(e) => handleSelectDate(new Date(e.target.value))}
            onBlur={() => setShowPicker(false)}
            style={styles.webInput as any}
            autoFocus
          />
        ) : null
      ) : (
        <Modal
          visible={showPicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowPicker(false)}>
          <Pressable style={styles.modalBackdrop} onPress={() => setShowPicker(false)}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Select date</Text>
              <View style={styles.modalControls}>
                {/* Simple quick-selects + manual day selection */}
                <TouchableOpacity
                  style={styles.dateOption}
                  onPress={() => handleSelectDate(new Date())}>
                  <Text style={styles.dateOptionText}>Today</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.dateOption}
                  onPress={() => handleSelectDate(new Date(Date.now() - 86400000))}>
                  <Text style={styles.dateOptionText}>Yesterday</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.dateOption}
                  onPress={() => handleSelectDate(new Date(Date.now() + 86400000))}>
                  <Text style={styles.dateOptionText}>Tomorrow</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.modalFooter}>
                <TouchableOpacity onPress={() => setShowPicker(false)} style={styles.closeButton}>
                  <Text style={styles.closeButtonText}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Pressable>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
  },
  dateDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  icon: {
    marginRight: 8,
  },
  dateText: {
    fontSize: 16,
    color: '#111827',
    fontWeight: '500',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  controlButton: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    borderRadius: 6,
    padding: 8,
    alignItems: 'center',
  },
  controlButtonText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 6,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  modalControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  dateOption: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
    marginHorizontal: 4,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    alignItems: 'center',
  },
  dateOptionText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  modalFooter: {
    marginTop: 12,
    alignItems: 'flex-end',
  },
  closeButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#e5e7eb',
    borderRadius: 8,
  },
  closeButtonText: {
    color: '#111827',
    fontWeight: '600',
  },
  webInput: {
    // Basic styling to make the native date input fit the component
    width: '100%',
    padding: 8,
    fontSize: 16,
    borderRadius: 8,
    border: 'none',
  } as any,
});
