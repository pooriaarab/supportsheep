"use client";

/**
 * New Post Page
 *
 * Quick form to create a new draft article, then redirects to the editor.
 */

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/layout/page-header";
import { Button } from "@repo/ui/primitives/button";
import { Input } from "@repo/ui/primitives/input";
import { Label } from "@repo/ui/primitives/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/primitives/select";
import { POST_TYPES } from "@repo/types";
import { useCreatePostMutation } from "../hooks/use-posts-query";
import { toast } from "sonner";

function formatPostType(type: string): string {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function NewPostPage() {
  const { push } = useRouter();
  const createMutation = useCreatePostMutation();
  const [title, setTitle] = useState("");
  const [postType, setPostType] = useState<string>("blog_post");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    try {
      const result = await createMutation.mutateAsync({
        title: title.trim(),
        postType: postType as (typeof POST_TYPES)[number],
        category: "",
      });
      push(`/posts/${encodeURIComponent(result.slug)}/edit`);
    } catch {
      toast.error("Failed to create post");
    }
  };

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        breadcrumbs={[
          { label: "Posts", href: "/posts" },
          { label: "New Post" },
        ]}
      />

      <div className="flex-1 flex items-start justify-center pt-24 px-4">
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-md space-y-6 bg-card border border-border rounded-lg p-6"
        >
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Create New Post</h2>
            <p className="text-xs text-muted-foreground">
              Give your post a title and type. You can edit everything else in
              the editor.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-post-title">Title</Label>
            <Input
              id="new-post-title"
              placeholder="e.g., How to Build a Blog"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={createMutation.isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-post-type">Post Type</Label>
            <Select value={postType} onValueChange={setPostType}>
              <SelectTrigger id="new-post-type">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {POST_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {formatPostType(type)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => push("/posts")}
              disabled={createMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!title.trim() || createMutation.isPending}
            >
              {createMutation.isPending ? "Creating..." : "Create & Edit"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
