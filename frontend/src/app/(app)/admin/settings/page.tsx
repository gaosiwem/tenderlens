"use client";

import * as React from "react";
import { toast } from "sonner";
import { TLSection } from "@/components/tenderlens/section";
import { TLButton } from "@/components/tenderlens/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  getSystemSettings,
  updateSystemSettings,
} from "@/lib/system-settings.api";
import { Loader2, Save } from "lucide-react";

export default function AdminSettingsPage() {
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [settings, setSettings] = React.useState({
    retentionDays: 30,
    hideClosedTenders: true,
  });

  React.useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const res = await getSystemSettings();
      if (res.ok) {
        setSettings(res.data);
      } else {
        toast.error("Failed to load settings");
      }
    } catch (e) {
      toast.error("Error loading settings");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await updateSystemSettings(settings);
      if (res.ok) {
        toast.success("Settings saved successfully");
        setSettings(res.data);
      } else {
        toast.error("Failed to save settings");
      }
    } catch (e) {
      toast.error("Error saving settings");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary/40" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <TLSection
        title="System Settings"
        description="Configure global application behavior and data retention policies."
      >
        <div className="max-w-2xl space-y-6">
          <Card>
            <CardContent className="p-6 space-y-8">
              <div className="space-y-4">
                <div className="text-sm font-bold uppercase tracking-wider text-primary/70">
                  Tender Retention Policy
                </div>

                <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-muted/20">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-bold">
                      Hide Closed Tenders
                    </Label>
                    <div className="text-xs text-muted-foreground">
                      Automatically filter out tenders from the main list once
                      their closing date has passed.
                    </div>
                  </div>
                  <Switch
                    checked={settings.hideClosedTenders}
                    onCheckedChange={(checked) =>
                      setSettings((prev) => ({
                        ...prev,
                        hideClosedTenders: checked,
                      }))
                    }
                  />
                </div>

                <div className="space-y-2 p-4 rounded-xl border border-border bg-muted/20">
                  <Label className="text-sm font-bold">
                    Retention Duration (Days)
                  </Label>
                  <div className="text-xs text-muted-foreground mb-3">
                    Number of days to keep tenders in the system after they
                    close. Older tenders will be permanently deleted.
                  </div>
                  <div className="flex items-center gap-4">
                    <Input
                      type="number"
                      className="max-w-[120px]"
                      value={settings.retentionDays}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          retentionDays: parseInt(e.target.value) || 0,
                        }))
                      }
                      min="1"
                      max="3650"
                    />
                    <span className="text-sm font-medium text-muted-foreground">
                      days
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t flex justify-end">
                <TLButton
                  onClick={handleSave}
                  disabled={saving}
                  className="gap-2"
                >
                  {saving ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Save className="size-4" />
                  )}
                  Save Changes
                </TLButton>
              </div>
            </CardContent>
          </Card>
        </div>
      </TLSection>
    </div>
  );
}
