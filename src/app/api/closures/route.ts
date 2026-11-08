import { route } from "@/lib/http";
import { closeFiscalYear, getClosureData } from "@/server/services/closure.service";

export const GET = route({ perm: "settings.manage" }, async () => {
  return getClosureData();
});

export const POST = route({ perm: "settings.manage" }, async ({ user, ip }) => {
  const result = await closeFiscalYear(user, ip);
  return result;
});

