import React, { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { X } from "lucide-react-native";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Switch,
  Alert as RNAlert,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AlertSettings, AlertType, CategoryBudget } from "@/types/alert";
import { alertStorage } from "@/utils/alertStorage";
import { Colors } from "@/constants/Colors";

export default function SettingsScreen() {
  const [settings, setSettings] = useState<AlertSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [newBudget, setNewBudget] = useState("");

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const loaded = await alertStorage.getSettings();
      setSettings(loaded);
    } catch (error) {
      console.error("❌ Error loading settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async (updated: AlertSettings) => {
    try {
      await alertStorage.saveSettings(updated);
      setSettings(updated);

      if (
        updated.dailyBudget ||
        updated.weeklyBudget ||
        updated.monthlyBudget ||
        updated.categoryBudgets.some((cb) => cb.enabled)
      ) {
        await alertStorage.setOnboardingComplete();
      }

      RNAlert.alert("Success", "Settings saved successfully!");
    } catch (error) {
      console.error("❌ Error saving settings:", error);
      RNAlert.alert("Error", "Failed to save settings. Please try again.");
    }
  };

  const updateBudget = (field: keyof AlertSettings, value: string) => {
    if (!settings) return;
    const numValue = value === "" ? null : parseFloat(value);
    const updated = { ...settings, [field]: numValue };
    setSettings(updated);
  };

  const toggleAlertType = (type: AlertType) => {
    if (!settings) return;
    const enabledAlerts = settings.enabledAlerts.includes(type)
      ? settings.enabledAlerts.filter((t) => t !== type)
      : [...settings.enabledAlerts, type];
    setSettings({ ...settings, enabledAlerts });
  };

  const addCategoryBudget = () => {
    setNewCategory("");
    setNewBudget("");
    setShowAddModal(true);
  };

  const saveNewCategoryBudget = () => {
    if (!settings) return;
    
    const trimmedCategory = newCategory.trim();
    const trimmedBudget = newBudget.trim();

    if (!trimmedCategory || !trimmedBudget) {
      RNAlert.alert("Error", "Please fill in both fields");
      return;
    }

    const monthlyLimit = parseFloat(trimmedBudget);
    if (isNaN(monthlyLimit) || monthlyLimit <= 0) {
      RNAlert.alert("Error", "Please enter a valid number");
      return;
    }

    // Check for duplicate category
    const isDuplicate = settings.categoryBudgets.some(
      (cb) => cb.category.toLowerCase() === trimmedCategory.toLowerCase()
    );

    if (isDuplicate) {
      RNAlert.alert("Error", "This category already exists");
      return;
    }

    const newItem: CategoryBudget = {
      category: trimmedCategory,
      monthlyLimit,
      enabled: true,
    };

    const updated = {
      ...settings,
      categoryBudgets: [...settings.categoryBudgets, newItem],
    };

    setSettings(updated);
    setShowAddModal(false);
    setNewCategory("");
    setNewBudget("");
    
    RNAlert.alert("Success", "Category budget added successfully!");
  };

  const toggleCategoryBudget = (index: number) => {
    if (!settings) return;
    const updated = [...settings.categoryBudgets];
    updated[index] = { ...updated[index], enabled: !updated[index].enabled };
    setSettings({ ...settings, categoryBudgets: updated });
  };

  const removeCategoryBudget = (index: number) => {
    if (!settings) return;
    RNAlert.alert(
      "Remove Budget",
      `Are you sure you want to remove "${settings.categoryBudgets[index].category}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            const updated = settings.categoryBudgets.filter((_, i) => i !== index);
            setSettings({ ...settings, categoryBudgets: updated });
          },
        },
      ]
    );
  };

  if (loading || !settings) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading settings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.navHeader}>
        <TouchableOpacity onPress={() => router.push("/dashboard")}>
          <X size={24} color={Colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Settings</Text>
        <View style={styles.navSpacer} />
      </View>

      <ScrollView style={styles.scrollView}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Alert Settings</Text>
          <Text style={styles.headerSubtitle}>
            Configure your spending alerts and budgets
          </Text>
        </View>

        {/* Budget Limits */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Budget Limits</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Daily Budget (₹)</Text>
            <TextInput
              style={styles.input}
              value={settings.dailyBudget?.toString() || ""}
              onChangeText={(value) => updateBudget("dailyBudget", value)}
              placeholder="e.g., 1000"
              keyboardType="numeric"
              placeholderTextColor={Colors.gray[400]}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Weekly Budget (₹)</Text>
            <TextInput
              style={styles.input}
              value={settings.weeklyBudget?.toString() || ""}
              onChangeText={(value) => updateBudget("weeklyBudget", value)}
              placeholder="e.g., 7000"
              keyboardType="numeric"
              placeholderTextColor={Colors.gray[400]}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Monthly Budget (₹)</Text>
            <TextInput
              style={styles.input}
              value={settings.monthlyBudget?.toString() || ""}
              onChangeText={(value) => updateBudget("monthlyBudget", value)}
              placeholder="e.g., 30000"
              keyboardType="numeric"
              placeholderTextColor={Colors.gray[400]}
            />
          </View>
        </View>

        {/* Category Budgets */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Category Budgets</Text>
            <TouchableOpacity onPress={addCategoryBudget} style={styles.addButton}>
              <Text style={styles.addButtonText}>+ Add</Text>
            </TouchableOpacity>
          </View>

          {settings.categoryBudgets.length === 0 ? (
            <Text style={styles.emptyText}>
              No category budgets set. Tap "+ Add" to create one.
            </Text>
          ) : (
            settings.categoryBudgets.map((cb, index) => (
              <View key={index} style={styles.categoryBudgetItem}>
                <View style={styles.categoryBudgetInfo}>
                  <Text style={styles.categoryName}>{cb.category}</Text>
                  <Text style={styles.categoryAmount}>₹{cb.monthlyLimit.toLocaleString()}/month</Text>
                </View>
                <View style={styles.categoryBudgetActions}>
                  <Switch
                    value={cb.enabled}
                    onValueChange={() => toggleCategoryBudget(index)}
                    trackColor={{ false: Colors.gray[300], true: Colors.primary }}
                    thumbColor="#fff"
                  />
                  <TouchableOpacity
                    onPress={() => removeCategoryBudget(index)}
                    style={styles.removeButton}
                  >
                    <Text style={styles.removeButtonText}>Remove</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Alert Types */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Alert Types</Text>

          {[
            { type: AlertType.DAILY_BUDGET, label: "Daily Budget Alerts" },
            { type: AlertType.WEEKLY_BUDGET, label: "Weekly Budget Alerts" },
            { type: AlertType.MONTHLY_BUDGET, label: "Monthly Budget Alerts" },
            { type: AlertType.CATEGORY_BUDGET, label: "Category Budget Alerts" },
            { type: AlertType.UNUSUAL_SPENDING, label: "Unusual Spending Alerts" },
            { type: AlertType.WEEKLY_SUMMARY, label: "Weekly Summary" },
            { type: AlertType.MONTHLY_COMPARISON, label: "Monthly Comparison" },
          ].map(({ type, label }) => (
            <View key={type} style={styles.toggleItem}>
              <Text style={styles.toggleLabel}>{label}</Text>
              <Switch
                value={settings.enabledAlerts.includes(type)}
                onValueChange={() => toggleAlertType(type)}
                trackColor={{ false: Colors.gray[300], true: Colors.primary }}
                thumbColor="#fff"
              />
            </View>
          ))}
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={styles.saveButton}
          onPress={async () => {
            await saveSettings(settings);
            router.push("/dashboard");
          }}
        >
          <Text style={styles.saveButtonText}>Save Settings</Text>
        </TouchableOpacity>

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Add Category Modal */}
      <Modal
        visible={showAddModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Category Budget</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <X size={20} color={Colors.text.primary} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalContent}>
              <View style={styles.modalInputGroup}>
                <Text style={styles.modalInputLabel}>Category Name</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="e.g., Food, Transport, Entertainment"
                  value={newCategory}
                  onChangeText={setNewCategory}
                  placeholderTextColor={Colors.gray[400]}
                  autoCapitalize="words"
                />
              </View>

              <View style={styles.modalInputGroup}>
                <Text style={styles.modalInputLabel}>Monthly Limit (₹)</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="e.g., 5000"
                  keyboardType="numeric"
                  value={newBudget}
                  onChangeText={setNewBudget}
                  placeholderTextColor={Colors.gray[400]}
                />
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => setShowAddModal(false)}
                style={[styles.modalButton, styles.modalButtonCancel]}
              >
                <Text style={styles.modalButtonTextCancel}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={saveNewCategoryBudget}
                style={[styles.modalButton, styles.modalButtonSave]}
              >
                <Text style={styles.modalButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: Colors.background 
  },
  navHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.backgroundSecondary,
  },
  navTitle: { 
    fontSize: 18, 
    fontWeight: "600", 
    color: Colors.text.primary 
  },
  navSpacer: { 
    width: 24 
  },
  loadingContainer: { 
    flex: 1, 
    justifyContent: "center", 
    alignItems: "center" 
  },
  loadingText: {
    fontSize: 16,
    color: Colors.text.secondary,
  },
  scrollView: { 
    flex: 1 
  },
  header: {
    padding: 20,
    backgroundColor: Colors.backgroundSecondary,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: { 
    fontSize: 24, 
    fontWeight: "700", 
    color: Colors.text.primary, 
    marginBottom: 4 
  },
  headerSubtitle: { 
    fontSize: 14, 
    color: Colors.text.secondary 
  },
  section: { 
    padding: 20, 
    borderBottomWidth: 1, 
    borderBottomColor: Colors.border 
  },
  sectionHeader: { 
    flexDirection: "row", 
    justifyContent: "space-between", 
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: { 
    fontSize: 16, 
    fontWeight: "600", 
    color: Colors.text.primary,
  },
  inputGroup: { 
    marginBottom: 16 
  },
  inputLabel: { 
    fontSize: 14, 
    fontWeight: "500", 
    color: Colors.text.primary, 
    marginBottom: 8 
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: Colors.background,
    color: Colors.text.primary,
  },
  addButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  addButtonText: { 
    color: "#fff", 
    fontSize: 14, 
    fontWeight: "600" 
  },
  emptyText: { 
    fontSize: 14, 
    color: Colors.text.secondary, 
    fontStyle: "italic",
    textAlign: "center",
    paddingVertical: 20,
  },
  categoryBudgetItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  categoryBudgetInfo: { 
    flex: 1 
  },
  categoryName: { 
    fontSize: 14, 
    fontWeight: "600", 
    color: Colors.text.primary 
  },
  categoryAmount: { 
    fontSize: 12, 
    color: Colors.text.secondary,
    marginTop: 2,
  },
  categoryBudgetActions: { 
    flexDirection: "row", 
    alignItems: "center", 
    gap: 12 
  },
  removeButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  removeButtonText: { 
    fontSize: 12, 
    color: Colors.error, 
    fontWeight: "500" 
  },
  toggleItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  toggleLabel: { 
    fontSize: 14, 
    color: Colors.text.primary 
  },
  saveButton: {
    backgroundColor: Colors.primary,
    margin: 20,
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  saveButtonText: { 
    color: "#fff", 
    fontSize: 16, 
    fontWeight: "600" 
  },
  bottomPadding: { 
    height: 40 
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    width: "90%",
    maxWidth: 400,
    overflow: "hidden",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: { 
    fontSize: 18, 
    fontWeight: "600", 
    color: Colors.text.primary,
  },
  modalContent: {
    padding: 16,
  },
  modalInputGroup: {
    marginBottom: 16,
  },
  modalInputLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: Colors.text.primary,
    marginBottom: 8,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: Colors.text.primary,
    backgroundColor: Colors.background,
  },
  modalActions: { 
    flexDirection: "row", 
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  modalButtonCancel: {
    backgroundColor: Colors.gray[300],
  },
  modalButtonSave: {
    backgroundColor: Colors.primary,
  },
  modalButtonText: { 
    color: "#fff", 
    fontSize: 16, 
    fontWeight: "600" 
  },
  modalButtonTextCancel: {
    color: Colors.text.primary,
    fontSize: 16,
    fontWeight: "600",
  },
});