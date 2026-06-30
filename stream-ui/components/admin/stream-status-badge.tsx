import { CheckCircle2, CircleHelp, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { StreamStatus } from "@/types";

export function StreamStatusBadge({ status }: { status: StreamStatus }) {
  if (status === "ok") {
    return (
      <Badge variant="success">
        <CheckCircle2 className="h-3 w-3" /> OK
      </Badge>
    );
  }
  if (status === "error") {
    return (
      <Badge variant="destructive">
        <XCircle className="h-3 w-3" /> Error
      </Badge>
    );
  }
  return (
    <Badge variant="secondary">
      <CircleHelp className="h-3 w-3" /> Unchecked
    </Badge>
  );
}
