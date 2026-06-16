/**
 * Light coverage for the onboarding "Create your knowledge base" form: it renders, a
 * successful POST /api/v1/blogs redirects to the dashboard, and a 409
 * slug_taken surfaces an inline message instead of redirecting.
 */

// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

// React 19's act() requires this flag when used outside @testing-library/react.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

import { OnboardingForm } from "../onboarding-form";

let container: HTMLDivElement;
let root: Root;

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

async function mount() {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(<OnboardingForm />);
  });
}

function setInput(id: string, value: string) {
  const input = container.querySelector(`#${id}`) as HTMLInputElement;
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )!.set!;
  setter.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

async function submitForm() {
  const form = container.querySelector("form") as HTMLFormElement;
  await act(async () => {
    form.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
    await Promise.resolve();
  });
}

describe("OnboardingForm", () => {
  beforeEach(() => {
    push.mockClear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("renders the create-your-blog form", async () => {
    await mount();
    expect(container.textContent).toContain("Create your knowledge base");
    expect(container.querySelector("#displayName")).not.toBeNull();
    expect(container.querySelector("#slug")).not.toBeNull();
  });

  it("POSTs to /api/v1/blogs and redirects to /dashboard on 201", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse(201, { id: "b1", slug: "my-support-hub" }));

    await mount();
    setInput("displayName", "My Support Hub");
    setInput("slug", "my-support-hub");
    await submitForm();

    const postCall = fetchMock.mock.calls.find(
      ([url, init]) =>
        url === "/api/v1/blogs" &&
        (init as RequestInit | undefined)?.method === "POST",
    );
    expect(postCall).toBeTruthy();
    expect(
      JSON.parse((postCall![1] as RequestInit).body as string),
    ).toEqual({ slug: "my-support-hub", displayName: "My Support Hub" });
    expect(push).toHaveBeenCalledWith("/dashboard");
  });

  it("shows an inline message and does not redirect on 409 slug_taken", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse(409, { error: "slug_taken" }),
    );

    await mount();
    setInput("displayName", "My Support Hub");
    setInput("slug", "taken-slug");
    await submitForm();

    expect(push).not.toHaveBeenCalled();
    expect(container.textContent).toContain("already taken");
  });
});
