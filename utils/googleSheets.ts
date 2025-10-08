import { Share, Platform } from 'react-native';
import { storageService } from './storage';

export const googleSheetsService = {
  async exportToCSV(): Promise<void> {
    try {
      const csv = await storageService.exportToCSV();

      if (Platform.OS === 'web') {
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `expenses_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        await Share.share({
          message: csv,
          title: 'Expense Report CSV',
        });
      }
    } catch (error) {
      console.error('Error exporting to CSV:', error);
      throw error;
    }
  },

  getInstructions(): string {
    return `To import this data into Google Sheets:

1. Export the CSV file using the Export button in the Dashboard
2. Open Google Sheets (sheets.google.com)
3. Create a new spreadsheet or open an existing one
4. Go to File > Import
5. Choose the CSV file you exported
6. Select "Insert new sheet(s)" or "Replace spreadsheet"
7. Click "Import data"

The CSV format matches the structure of your expense tracking form.`;
  },
};
