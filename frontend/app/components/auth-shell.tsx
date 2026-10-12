import type { ReactNode } from "react";
import type { User } from "../lib/auth";
import { SecondaryShell } from "./secondary-shell";
export function AuthShell({ title, subtitle, user = null, auth = false, children }: { title: string; subtitle: string; user?: User | null; auth?: boolean; children: ReactNode }) {
  return <SecondaryShell title={title} subtitle={subtitle} user={user} auth={auth}>{children}</SecondaryShell>;
}
