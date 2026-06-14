import type { CanvasState } from "@/hooks/use-interview-session";

interface Props {
  canvas: CanvasState;
}

/**
 * Image tab. Renders the AI-generated featured image once the
 * `featured_image_updated` writer diff arrives. Until then, surfaces the
 * best available concept hint (title, subtitle, or topic placeholder) so
 * the author can see the image will reflect their draft.
 */
export function ImageTab({ canvas }: Props) {
  const featuredImage = canvas.featuredImage;
  const hasTitle = Boolean(canvas.title);
  const hasSubtitle = Boolean(canvas.subtitle);
  const conceptLabel = featuredImage?.prompt
    ? "AI Image Concept"
    : hasTitle
      ? "AI Featured Image Placeholder"
      : null;

  return (
    <div className="flex flex-col items-center justify-center h-[550px] border border-border bg-muted/20 rounded-lg p-6 text-center shadow-sm">
      <div className="max-w-md space-y-4">
        <div className="w-full aspect-video bg-muted rounded-md flex items-center justify-center border border-border relative overflow-hidden">
          {featuredImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={featuredImage.url}
              alt={featuredImage.alt}
              className="absolute inset-0 h-full w-full object-cover"
              data-testid="image-tab-featured"
            />
          ) : (
            <>
              <div className="absolute inset-0 bg-gradient-to-tr from-primary/10 via-background to-accent/10" />
              <div className="z-10 text-muted-foreground p-4">
                {hasTitle ? (
                  <div className="space-y-2">
                    <p className="font-semibold text-foreground text-sm uppercase tracking-wider">{conceptLabel}</p>
                    <p className="text-xs italic max-w-xs mx-auto text-muted-foreground line-clamp-2">&ldquo;{canvas.title}&rdquo;</p>
                    {hasSubtitle && (
                      <p
                        data-testid="image-tab-subtitle"
                        className="text-[11px] max-w-xs mx-auto text-muted-foreground line-clamp-2"
                      >
                        {canvas.subtitle}
                      </p>
                    )}
                    <div className="w-8 h-1 bg-primary mx-auto my-3 rounded animate-pulse" />
                  </div>
                ) : (
                  <p className="text-sm">Waiting for article title to generate image concept...</p>
                )}
              </div>
            </>
          )}
        </div>
        {featuredImage ? (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground leading-relaxed">
              {featuredImage.alt}
            </p>
            {featuredImage.prompt && (
              <p
                data-testid="image-tab-prompt"
                className="text-[11px] text-muted-foreground italic leading-relaxed"
              >
                Prompt: {featuredImage.prompt}
              </p>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground leading-relaxed">
            The featured image will be automatically rendered once the draft is finalized and ready to publish.
          </p>
        )}
      </div>
    </div>
  );
}
