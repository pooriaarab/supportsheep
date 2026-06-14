import type {
  FreeTool,
  FreeToolCategory,
  FreeToolExecutionMode,
  FreeToolInputField,
} from "@repo/types";

export type FreeToolInput = Record<string, string | number | boolean | null | undefined>;

export type FreeToolResult =
  | {
      kind: "stats";
      summary: string;
      metrics: Record<string, number | string>;
    }
  | {
      kind: "text";
      summary: string;
      text: string;
    }
  | {
      kind: "json";
      summary: string;
      json: Record<string, unknown>;
    };

export type FreeToolExecutor = (input: FreeToolInput) => Promise<FreeToolResult>;

export interface FreeToolTemplate {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: FreeToolCategory;
  executionMode: FreeToolExecutionMode;
  family: string;
  inputs: FreeToolInputField[];
  seo: {
    metaTitle: string;
    metaDescription: string;
  };
  deterministicExecutor?: FreeToolExecutor;
  defaultPrompt?: string;
}

export type DefaultFreeToolOptions = {
  enabled: boolean;
  aiEnabled: boolean;
  blogId?: "default";
  now?: string;
};

export type SeededFreeTool = FreeTool;

export type FreeToolAdminListItem = Pick<
  FreeTool,
  | "id"
  | "templateId"
  | "slug"
  | "title"
  | "enabled"
  | "source"
>;

export type FreeToolAdminUpdateInput = Partial<
  Pick<
    FreeTool,
    | "slug"
    | "title"
    | "metaTitle"
    | "metaDescription"
    | "intro"
    | "faq"
    | "cta"
    | "enabled"
  >
> & {
  appearance?: Partial<FreeTool["appearance"]>;
  ai?: Partial<FreeTool["ai"]>;
  seo?: Partial<FreeTool["seo"]>;
  callout?: Partial<FreeTool["callout"]>;
};
