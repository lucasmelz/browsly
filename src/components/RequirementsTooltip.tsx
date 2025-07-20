import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Info } from "lucide-react";

interface RequirementsTooltipProps {
  requirements: {
    type: string;
    description: string;
  }[];
  className?: string;
}

export function RequirementsTooltip({
  requirements,
  className,
}: RequirementsTooltipProps) {
  return (
    <div className={className}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-2 cursor-pointer">
              <Info className="h-5 w-5" />
              <span className="font-semibold">Requirements</span>
            </div>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <ul className="list-disc space-y-2 p-4">
              {requirements.map((req, index) => (
                <li key={index}>
                  <span className="font-bold">{req.type}:</span>{" "}
                  {req.description}
                </li>
              ))}
            </ul>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}