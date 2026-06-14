/**
 * Templates API
 *
 * GET    /api/v1/templates -- List templates (scoped to caller's blog)
 * POST   /api/v1/templates -- Create a template
 * PUT    /api/v1/templates -- Update a template (by id in body)
 * DELETE /api/v1/templates -- Delete a template (by id in body)
 */

import { NextResponse } from "next/server";
import { z } from "zod";

import { createApiHandler } from "@/lib/create-api-handler";
import {
  createTemplate,
  deleteTemplate,
  listTemplates,
  updateTemplate,
} from "@/lib/templates/repository";

const createTemplateSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().max(500).optional().default(""),
  category: z.string().max(50).optional().default("General"),
  fields: z.number().int().min(0).optional().default(0),
});

const updateTemplateSchema = z.object({
  id: z.string().min(1, "Template ID is required"),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  category: z.string().max(50).optional(),
  fields: z.number().int().min(0).optional(),
});

const deleteTemplateSchema = z.object({
  id: z.string().min(1, "Template ID is required"),
});

/**
 * GET /api/v1/templates
 * List templates scoped to the caller's blog.
 */
export const GET = createApiHandler({
  auth: "user",
  handler: async ({ blogId }) => {
    const data = await listTemplates(blogId);
    return NextResponse.json({ data });
  },
});

/**
 * POST /api/v1/templates
 * Create a new template for the caller's blog.
 */
export const POST = createApiHandler({
  auth: "user",
  input: createTemplateSchema,
  audit: "create_template",
  handler: async ({ body, blogId }) => {
    const result = await createTemplate(blogId, body);
    return NextResponse.json(result, { status: 201 });
  },
});

/**
 * PUT /api/v1/templates
 * Update a template (scoped to caller's blog; 404 if not found or wrong blog).
 */
export const PUT = createApiHandler({
  auth: "user",
  input: updateTemplateSchema,
  audit: "update_template",
  handler: async ({ body, blogId }) => {
    const { id, ...patch } = body;
    const updated = await updateTemplate(blogId, id, patch);
    if (!updated) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }
    return NextResponse.json({ data: updated });
  },
});

/**
 * DELETE /api/v1/templates
 * Delete a template (scoped to caller's blog; 404 if not found or wrong blog).
 */
export const DELETE = createApiHandler({
  auth: "user",
  input: deleteTemplateSchema,
  audit: "delete_template",
  handler: async ({ body, blogId }) => {
    const deleted = await deleteTemplate(blogId, body.id);
    if (!deleted) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }
    return NextResponse.json({ deleted: true });
  },
});
