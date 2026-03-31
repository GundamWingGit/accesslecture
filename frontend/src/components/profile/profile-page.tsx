"use client";

import { useState } from "react";
import { User, Building2, Lock, Save, ArrowLeft, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { getSupabaseBrowser } from "@/lib/supabase";

interface ProfilePageProps {
  onBack: () => void;
}

export function ProfilePage({ onBack }: ProfilePageProps) {
  const { user } = useAuth();
  const sb = getSupabaseBrowser();

  const meta = user?.user_metadata ?? {};
  const [displayName, setDisplayName] = useState<string>(meta.display_name ?? "");
  const [institution, setInstitution] = useState<string>(meta.institution ?? "");
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [savingPw, setSavingPw] = useState(false);

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      const { error } = await sb.auth.updateUser({
        data: { display_name: displayName.trim(), institution: institution.trim() },
      });
      if (error) throw error;
      toast.success("Profile updated");
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to update profile");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPw.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (newPw !== confirmPw) {
      toast.error("Passwords don't match");
      return;
    }
    setSavingPw(true);
    try {
      const { error } = await sb.auth.updateUser({ password: newPw });
      if (error) throw error;
      toast.success("Password changed");
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to change password");
    } finally {
      setSavingPw(false);
    }
  };

  const initials = displayName
    ? displayName
        .split(" ")
        .map((w) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : (user?.email?.[0] ?? "U").toUpperCase();

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <Button variant="ghost" size="sm" onClick={onBack}>
        <ArrowLeft className="w-4 h-4 mr-1" />
        Back
      </Button>

      {/* Avatar + email */}
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-primary-foreground text-xl font-bold shadow-lg shadow-primary/20">
          {initials}
        </div>
        <div>
          <p className="font-semibold text-lg">{displayName || "No name set"}</p>
          <p className="text-sm text-muted-foreground">{user?.email}</p>
        </div>
      </div>

      {/* Profile details */}
      <div className="glass rounded-2xl overflow-hidden">
        <div className="p-5 pb-3">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <User className="w-4 h-4" /> Profile
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Your display name and institution are shown on exported compliance reports.
          </p>
        </div>
        <div className="px-5 pb-5 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="display-name">Display Name</Label>
            <Input
              id="display-name"
              placeholder="e.g. Professor Frid"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="institution">
              <Building2 className="w-3.5 h-3.5 inline mr-1" />
              Institution
            </Label>
            <Input
              id="institution"
              placeholder="e.g. University of Michigan"
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
            />
          </div>
          <Button onClick={handleSaveProfile} disabled={savingProfile} className="rounded-xl btn-gradient shadow-md">
            {savingProfile ? (
              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-1.5" />
            )}
            Save Profile
          </Button>
        </div>
      </div>

      {/* Change password */}
      <div className="glass rounded-2xl overflow-hidden">
        <div className="p-5 pb-3">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Lock className="w-4 h-4" /> Change Password
          </h3>
        </div>
        <div className="px-5 pb-5 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-pw">New Password</Label>
            <Input
              id="new-pw"
              type="password"
              placeholder="Min 8 characters"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-pw">Confirm Password</Label>
            <Input
              id="confirm-pw"
              type="password"
              placeholder="Repeat new password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
            />
          </div>
          <Button onClick={handleChangePassword} disabled={savingPw} variant="outline" className="rounded-xl">
            {savingPw ? (
              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
            ) : (
              <Lock className="w-4 h-4 mr-1.5" />
            )}
            Change Password
          </Button>
        </div>
      </div>
    </div>
  );
}
