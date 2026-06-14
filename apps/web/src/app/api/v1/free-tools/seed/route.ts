import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/create-api-handler";
import { seedDefaultFreeTools } from "@/lib/free-tools/repository";

export const POST = createApiHandler({
  auth: "admin",
  handler: async ({ blogId }) => {
    const data = await seedDefaultFreeTools(
      { enabled: true, aiEnabled: true },
      blogId,
    );
    return NextResponse.json({ data });
  },
});
