"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/primitives/dialog";
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
import { useCreatePostMutation } from "../hooks/use-posts-query";
import { POST_TYPES } from "@repo/types";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface CreatePostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreatePostDialog({
  open,
  onOpenChange,
}: CreatePostDialogProps) {
  const [title, setTitle] = useState("");
  const [postType, setPostType] = useState<string>("blog_post");
  const createMutation = useCreatePostMutation();
  const { push } = useRouter();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!title.trim()) return;

    try {
      const result = await createMutation.mutateAsync({
        title: title.trim(),
        postType: postType as (typeof POST_TYPES)[number],
        category: "",
      });
      toast.success("Post created");
      onOpenChange(false);
      setTitle("");
      setPostType("blog_post");
      push(`/posts/${encodeURIComponent(result.slug)}/edit`);
    } catch {
      toast.error("Failed to create post");
    }
  };

  function formatPostType(type: string): string {
    return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Post</DialogTitle>
          <DialogDescription>
            Start a new blog post. You can edit it after creation.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="post-title">Title</Label>
            <Input
              id="post-title"
              placeholder="e.g., How to Build a Blog"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={createMutation.isPending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="post-type">Post Type</Label>
            <Select value={postType} onValueChange={setPostType}>
              <SelectTrigger id="post-type">
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
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={createMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!title.trim() || createMutation.isPending}
            >
              {createMutation.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
