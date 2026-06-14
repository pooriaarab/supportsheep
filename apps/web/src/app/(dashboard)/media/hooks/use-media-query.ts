import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import type { MediaItem } from "@repo/types";

async function fetchMedia(): Promise<MediaItem[]> {
  const res = await fetch("/api/v1/media");
  if (!res.ok) {
    throw new Error("Failed to fetch media");
  }
  const json = (await res.json()) as { data: MediaItem[] };
  return json.data;
}

async function uploadMedia(
  file: File,
  alt: string,
): Promise<{ id: string; url: string; filename: string }> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("alt", alt);

  const res = await fetch("/api/v1/media", {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const err = (await res.json()) as { error: string };
    throw new Error(err.error || "Upload failed");
  }
  return (await res.json()) as { id: string; url: string; filename: string };
}

async function updateMediaAlt(id: string, alt: string): Promise<void> {
  const res = await fetch(`/api/v1/media/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ alt }),
  });
  if (!res.ok) {
    throw new Error("Failed to update media");
  }
}

async function deleteMedia(id: string): Promise<void> {
  const res = await fetch(`/api/v1/media/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    throw new Error("Failed to delete media");
  }
}

export function useMediaQuery() {
  return useQuery({
    queryKey: queryKeys.media.lists(),
    queryFn: fetchMedia,
  });
}

export function useUploadMediaMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ file, alt }: { file: File; alt: string }) =>
      uploadMedia(file, alt),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.media.all });
    },
  });
}

export function useUpdateMediaAltMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, alt }: { id: string; alt: string }) =>
      updateMediaAlt(id, alt),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.media.all });
    },
  });
}

export function useDeleteMediaMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteMedia,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.media.all });
    },
  });
}
