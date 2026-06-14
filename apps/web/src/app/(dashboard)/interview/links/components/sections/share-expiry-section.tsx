"use client";

import React from "react";
import { Label } from "@repo/ui/primitives/label";
import { Input } from "@repo/ui/primitives/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/primitives/select";

interface ShareExpirySectionProps {
  expiresAt: string; // ISO string or ""
  onExpiresAtChange: (value: string) => void;
  maxUses: number | null;
  onMaxUsesChange: (value: number | null) => void;
}

export function ShareExpirySection({
  expiresAt,
  onExpiresAtChange,
  maxUses,
  onMaxUsesChange,
}: ShareExpirySectionProps) {
  // Convert ISO to YYYY-MM-DD for native input
  const dateValue = expiresAt ? expiresAt.substring(0, 10) : "";

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (!val) {
      onExpiresAtChange("");
    } else {
      // Set to 23:59:59.999 UTC of that day to be helpful, or just end of day
      const date = new Date(val);
      date.setHours(23, 59, 59, 999);
      onExpiresAtChange(date.toISOString());
    }
  };

  const selectValue = maxUses === null ? "unlimited" : String(maxUses);

  const handleSelectChange = (val: string) => {
    if (val === "unlimited") {
      onMaxUsesChange(null);
    } else {
      onMaxUsesChange(Number(val));
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-foreground">Validity</h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="expires-at" className="text-xs text-muted-foreground font-medium">
            Expires
          </Label>
          <Input
            id="expires-at"
            type="date"
            value={dateValue}
            onChange={handleDateChange}
            className="w-full"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="max-uses" className="text-xs text-muted-foreground font-medium">
            Max uses
          </Label>
          <Select value={selectValue} onValueChange={handleSelectChange}>
            <SelectTrigger id="max-uses" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1 (one-time link)</SelectItem>
              <SelectItem value="3">3 uses</SelectItem>
              <SelectItem value="10">10 uses</SelectItem>
              <SelectItem value="25">25 uses</SelectItem>
              <SelectItem value="100">100 uses</SelectItem>
              <SelectItem value="unlimited">Unlimited</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
