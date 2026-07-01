import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function getShellProps() {
  const user = await getSessionUser();

  if (!user) {
    redirect("/login");
  }

  const settings = await prisma.hotelSettings.findUnique({
    where: { id: "default" },
  });

  return {
    user,
    hotelName: settings?.name || "RealtyBytes PMS",
  };
}
