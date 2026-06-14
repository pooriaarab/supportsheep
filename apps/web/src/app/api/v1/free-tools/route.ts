import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/create-api-handler";
import { listFreeTools } from "@/lib/free-tools/repository";

export const GET = createApiHandler({
  auth: "user",
  handler: async ({ blogId }) => {
    const data = await listFreeTools(blogId);
    return NextResponse.json({ data });
  },
});
