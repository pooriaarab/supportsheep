/**
 * Budget Reached Dialog
 *
 * A reusable dialog shown when an agent's monthly budget is exhausted.
 * Displays spend vs budget progress, utilization percentage, and optional
 * action to increase the budget.
 */

'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../primitives/dialog';
import { Button } from '../primitives/button';
import { Badge } from '../primitives/badge';

interface BudgetReachedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentName: string;
  currentSpend: number;
  monthlyBudget: number;
  onIncreaseBudget?: () => void;
}

export function BudgetReachedDialog({
  open,
  onOpenChange,
  agentName,
  currentSpend,
  monthlyBudget,
  onIncreaseBudget,
}: BudgetReachedDialogProps) {
  const utilization = monthlyBudget > 0
    ? Math.round((currentSpend / monthlyBudget) * 100)
    : 0;
  const progressWidth = Math.min(utilization, 100);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Budget Limit Reached</DialogTitle>
          <DialogDescription>
            {agentName} has used ${currentSpend.toFixed(2)} of its $
            {monthlyBudget.toFixed(2)} monthly budget.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Progress bar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>${currentSpend.toFixed(2)}</span>
              <span>${monthlyBudget.toFixed(2)}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-destructive transition-[width]"
                style={{ width: `${progressWidth}%` }}
              />
            </div>
          </div>

          {/* Utilization badge */}
          <div className="flex items-center gap-2">
            <Badge variant="destructive" className="text-xs">
              {utilization}% utilized
            </Badge>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Dismiss
          </Button>
          {onIncreaseBudget && (
            <Button onClick={onIncreaseBudget}>
              Increase Budget
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
