// src/components/PreferencesDialog.tsx
import { useState } from 'react';
import { usePreferences, validatePreferences, PREFERENCE_CATEGORIES } from '../hooks/usePreferences';

interface PreferencesDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PreferencesDialog({ isOpen, onClose }: PreferencesDialogProps) {
  const {
    preferences,
    savePreferences,
    resetPreferences,
    updateTheme,
    updateLanguage,
    updateDefaultSegmentMode,
    updateExportFormat,
    updateItemsPerPage,
    updateNotifications,
    updateUI
  } = usePreferences();

  const [activeTab, setActiveTab] = useState<'appearance' | 'behavior' | 'export' | 'notifications'>('appearance');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-surface border border-border rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-border">
          <h2 className="text-xl font-semibold">Preferences</h2>
          <button
            onClick={onClose}
            className="text-secondary hover:text-primary"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border">
          {[
            { id: 'appearance', label: 'Appearance' },
            { id: 'behavior', label: 'Behavior' },
            { id: 'export', label: 'Export' },
            { id: 'notifications', label: 'Notifications' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-6 py-3 font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-secondary hover:text-primary border-b-2 border-transparent'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'appearance' && (
            <AppearanceTab 
              preferences={preferences}
              updateTheme={updateTheme}
              updateLanguage={updateLanguage}
              updateUI={updateUI}
            />
          )}
          
          {activeTab === 'behavior' && (
            <BehaviorTab 
              preferences={preferences}
              updateDefaultSegmentMode={updateDefaultSegmentMode}
              updateItemsPerPage={updateItemsPerPage}
              updateUI={updateUI}
            />
          )}
          
          {activeTab === 'export' && (
            <ExportTab 
              preferences={preferences}
              updateExportFormat={updateExportFormat}
              updateUI={updateUI}
            />
          )}
          
          {activeTab === 'notifications' && (
            <NotificationsTab 
              preferences={preferences}
              updateNotifications={updateNotifications}
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center p-6 border-t border-border">
          <button
            onClick={resetPreferences}
            className="px-4 py-2 bg-surface-elevated border border-border rounded-lg hover:bg-surface"
          >
            Reset to Defaults
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-surface-elevated border border-border rounded-lg hover:bg-surface"
            >
              Cancel
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AppearanceTab({ preferences, updateTheme, updateLanguage, updateUI }: any) {
  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-secondary mb-2">Theme</label>
        <select
          value={preferences.theme}
          onChange={(e) => updateTheme(e.target.value)}
          className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-lg"
        >
          <option value="light">Light</option>
          <option value="dark">Dark</option>
          <option value="system">System</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-secondary mb-2">Language</label>
        <select
          value={preferences.language}
          onChange={(e) => updateLanguage(e.target.value)}
          className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-lg"
        >
          <option value="en">English</option>
          <option value="el">Ελληνικά</option>
          <option value="es">Español</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-secondary mb-2">UI Options</label>
        <div className="space-y-3">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={preferences.ui.compactMode}
              onChange={(e) => updateUI({ compactMode: e.target.checked })}
            />
            Compact mode
          </label>
          
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={preferences.ui.showSidebar}
              onChange={(e) => updateUI({ showSidebar: e.target.checked })}
            />
            Show sidebar by default
          </label>
        </div>
      </div>
    </div>
  );
}

function BehaviorTab({ preferences, updateDefaultSegmentMode, updateItemsPerPage }: any) {
  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-secondary mb-2">Default Segmentation Mode</label>
        <select
          value={preferences.defaultSegmentMode}
          onChange={(e) => updateDefaultSegmentMode(e.target.value)}
          className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-lg"
        >
          <option value="qa">Q&A</option>
          <option value="paragraphs">Paragraphs</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-secondary mb-2">Items per page</label>
        <input
          type="number"
          min="5"
          max="100"
          value={preferences.itemsPerPage}
          onChange={(e) => updateItemsPerPage(parseInt(e.target.value))}
          className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-lg"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-secondary mb-2">Behavior Options</label>
        <div className="space-y-3">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={preferences.autoSave}
              onChange={(e) => updateUI({ autoSave: e.target.checked })}
            />
            Auto-save documents
          </label>
          
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={preferences.autoSegment}
              onChange={(e) => updateUI({ autoSegment: e.target.checked })}
            />
            Auto-segment after upload
          </label>
        </div>
      </div>
    </div>
  );
}

function ExportTab({ preferences, updateExportFormat }: any) {
  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-secondary mb-2">Default Export Format</label>
        <select
          value={preferences.exportFormat}
          onChange={(e) => updateExportFormat(e.target.value)}
          className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-lg"
        >
          <option value="json">JSON</option>
          <option value="csv">CSV</option>
          <option value="txt">Plain Text</option>
          <option value="md">Markdown</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-secondary mb-2">Export Options</label>
        <div className="space-y-3">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={preferences.showLineNumbers}
              onChange={(e) => updateUI({ showLineNumbers: e.target.checked })}
            />
            Include line numbers in text exports
          </label>
        </div>
      </div>
    </div>
  );
}

function NotificationsTab({ preferences, updateNotifications }: any) {
  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-secondary mb-2">Notification Preferences</label>
        <div className="space-y-3">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={preferences.notifications.email}
              onChange={(e) => updateNotifications({ email: e.target.checked })}
            />
            Email notifications
          </label>
          
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={preferences.notifications.browser}
              onChange={(e) => updateNotifications({ browser: e.target.checked })}
            />
            Browser notifications
          </label>
          
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={preferences.notifications.sounds}
              onChange={(e) => updateNotifications({ sounds: e.target.checked })}
            />
            Sound effects
          </label>
        </div>
      </div>
    </div>
  );
}
