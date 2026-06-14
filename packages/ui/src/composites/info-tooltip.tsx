'use client';

import { Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../primitives/tooltip';
import { cn } from '../utils';

interface InfoTooltipProps {
  content: string;
  className?: string;
}

export function InfoTooltip({ content, className }: InfoTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Info
          className={cn(
            'size-3.5 text-muted-foreground/50 hover:text-muted-foreground cursor-help inline-block ml-1',
            className,
          )}
        />
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[250px] text-xs">
        {content}
      </TooltipContent>
    </Tooltip>
  );
}
