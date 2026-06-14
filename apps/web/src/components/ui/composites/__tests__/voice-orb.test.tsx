import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { VoiceOrb } from "../voice-orb";

describe("VoiceOrb", () => {
  it("renders with the correct state attribute", () => {
    const html = renderToStaticMarkup(<VoiceOrb state="listening" />);
    expect(html).toContain('data-state="listening"');
  });

  it("applies the requested pixel size", () => {
    // SIZES.md is 128px
    const html = renderToStaticMarkup(<VoiceOrb state="speaking" size="md" />);
    expect(html).toContain("width:128px");
    expect(html).toContain("height:128px");
  });

  it("applies an audio-reactive scale while speaking", () => {
    // Speaking with audioLevel 0.5 should scale to 1.06 (1 + 0.5 * 0.12)
    const html = renderToStaticMarkup(
      <VoiceOrb state="speaking" audioLevel={0.5} size="md" />,
    );
    expect(html).toContain("scale(1.06)");
  });

  it("caps the audio-reactive scale at 1.12", () => {
    const html = renderToStaticMarkup(
      <VoiceOrb state="speaking" audioLevel={2.0} size="md" />,
    );
    expect(html).toContain("scale(1.12)");
  });

  describe("state -> CSS variables", () => {
    it("listening uses --info as --orb-color", () => {
      const html = renderToStaticMarkup(<VoiceOrb state="listening" />);
      expect(html).toContain("--orb-color:var(--info)");
    });

    it("speaking uses --success as --orb-color", () => {
      const html = renderToStaticMarkup(<VoiceOrb state="speaking" />);
      expect(html).toContain("--orb-color:var(--success)");
    });

    it("thinking uses --warning as --orb-color", () => {
      const html = renderToStaticMarkup(<VoiceOrb state="thinking" />);
      expect(html).toContain("--orb-color:var(--warning)");
    });

    it("error uses --destructive as --orb-color", () => {
      const html = renderToStaticMarkup(<VoiceOrb state="error" />);
      expect(html).toContain("--orb-color:var(--destructive)");
    });

    it("idle uses --muted-foreground as --orb-color", () => {
      const html = renderToStaticMarkup(<VoiceOrb state="idle" />);
      expect(html).toContain("--orb-color:var(--muted-foreground)");
    });
  });

  describe("state -> animation classes", () => {
    /**
     * Extracts the className attribute applied to the inner orb element so
     * assertions check the actual class list rather than substring-matching
     * against the colocated <style> block — which always references every
     * `voice-orb--*` class name regardless of state.
     */
    function orbClassList(html: string): string {
      const match = html.match(/class="(voice-orb [^"]+)"/);
      return match?.[1] ?? "";
    }

    it("listening enables pulse + morph", () => {
      const html = renderToStaticMarkup(<VoiceOrb state="listening" />);
      const classList = orbClassList(html);
      expect(classList).toContain("voice-orb--pulse");
      expect(classList).toContain("voice-orb--morph");
    });

    it("speaking enables ripple + pulse + morph", () => {
      const html = renderToStaticMarkup(<VoiceOrb state="speaking" />);
      const classList = orbClassList(html);
      expect(classList).toContain("voice-orb--ripple");
      expect(classList).toContain("voice-orb--pulse");
      expect(classList).toContain("voice-orb--morph");
    });

    it("thinking enables rotation + pulse + morph", () => {
      const html = renderToStaticMarkup(<VoiceOrb state="thinking" />);
      const classList = orbClassList(html);
      expect(classList).toContain("voice-orb--rotate");
      expect(classList).toContain("voice-orb--pulse");
      expect(classList).toContain("voice-orb--morph");
    });

    it("idle morphs slowly but does not pulse, ripple, or rotate", () => {
      const html = renderToStaticMarkup(<VoiceOrb state="idle" />);
      const classList = orbClassList(html);
      expect(classList).toContain("voice-orb--morph");
      expect(classList).not.toContain("voice-orb--pulse");
      expect(classList).not.toContain("voice-orb--ripple");
      expect(classList).not.toContain("voice-orb--rotate");
    });

    it("error strips all animation classes", () => {
      const html = renderToStaticMarkup(<VoiceOrb state="error" />);
      const classList = orbClassList(html);
      expect(classList).not.toContain("voice-orb--morph");
      expect(classList).not.toContain("voice-orb--pulse");
      expect(classList).not.toContain("voice-orb--ripple");
      expect(classList).not.toContain("voice-orb--rotate");
    });

    it("drives the morph from the `orb-morph` border-radius keyframes", () => {
      // The fix swaps a jagged clip-path polygon morph for a smooth
      // border-radius percentage tween. Whenever the morph class is applied
      // the colocated <style> block must reference the `orb-morph` animation
      // — that's the load-bearing piece that makes the shape change feel
      // organic instead of angular. The keyframes themselves live in
      // `globals.css` so Tailwind's theme registry picks them up; the
      // component only needs to reference the animation by name.
      const html = renderToStaticMarkup(<VoiceOrb state="listening" />);
      expect(html).toContain("voice-orb--morph");
      expect(html).toMatch(
        /\.voice-orb--morph\s*\{\s*animation:\s*orb-morph/,
      );
      // Guard against regressing to the old clip-path polygon morph.
      expect(html).not.toContain("clip-path: polygon");
    });
  });

  describe("prefers-reduced-motion", () => {
    it("gates morph + rotation + pulse keyframes behind motion-safe via CSS", () => {
      // The component's keyframe rules are wrapped in
      // @media (prefers-reduced-motion: no-preference) inside the colocated
      // <style> block — that gives users with reduced-motion preferences a
      // still, color-shifted orb (color change still happens via the base
      // background/box-shadow transition).
      const html = renderToStaticMarkup(<VoiceOrb state="speaking" />);
      expect(html).toContain("@media (prefers-reduced-motion: no-preference)");
    });
  });

  describe("v3 — particle field + conic + ring + audio-reactive halo", () => {
    function countParticles(html: string): number {
      // Particles are the only nodes with the literal "voice-orb__particle"
      // (with no trailing class qualifier) — count occurrences as a class name
      // by matching the class= attribute directly.
      const matches = html.match(/class="voice-orb__particle"/g);
      return matches?.length ?? 0;
    }

    it("renders a thinking-state particle field denser than other states", () => {
      const thinking = renderToStaticMarkup(<VoiceOrb state="thinking" />);
      const speaking = renderToStaticMarkup(<VoiceOrb state="speaking" />);
      const idle = renderToStaticMarkup(<VoiceOrb state="idle" />);

      // The whole "more alive" thinking treatment depends on the field being
      // visibly denser — 16 dots vs 10 (speaking) vs 6 (idle).
      expect(countParticles(thinking)).toBeGreaterThan(countParticles(speaking));
      expect(countParticles(speaking)).toBeGreaterThan(countParticles(idle));
      expect(countParticles(thinking)).toBe(16);
    });

    it("does not render the particle field in error state", () => {
      const html = renderToStaticMarkup(<VoiceOrb state="error" />);
      expect(countParticles(html)).toBe(0);
    });

    it("only renders the counter-rotating ring while thinking", () => {
      const thinking = renderToStaticMarkup(<VoiceOrb state="thinking" />);
      const speaking = renderToStaticMarkup(<VoiceOrb state="speaking" />);
      expect(thinking).toMatch(/class="voice-orb__ring"/);
      // The class name appears in the colocated <style> block for both
      // states; what matters is whether the actual node is rendered. The
      // ring element uses class="voice-orb__ring" with no qualifier.
      expect(speaking).not.toMatch(/<span[^>]*class="voice-orb__ring"/);
    });

    it("boosts halo opacity when speaking with a non-zero audio level", () => {
      const silent = renderToStaticMarkup(<VoiceOrb state="speaking" audioLevel={0} />);
      const loud = renderToStaticMarkup(<VoiceOrb state="speaking" audioLevel={1} />);

      const haloVarRe = /--orb-halo-opacity:([\d.]+)/;
      const silentMatch = silent.match(haloVarRe);
      const loudMatch = loud.match(haloVarRe);
      expect(silentMatch).not.toBeNull();
      expect(loudMatch).not.toBeNull();
      const silentValue = Number(silentMatch![1]);
      const loudValue = Number(loudMatch![1]);
      expect(loudValue).toBeGreaterThan(silentValue);
    });

    it("does not amplitude-boost halo opacity outside speaking/listening", () => {
      const idleSilent = renderToStaticMarkup(<VoiceOrb state="idle" audioLevel={0} />);
      const idleLoud = renderToStaticMarkup(<VoiceOrb state="idle" audioLevel={1} />);
      // audioLevel is only sampled while the AI is speaking or the user mic
      // is open — outside those states a stale or zeroed value must not
      // visually inflate the halo.
      expect(idleSilent).toEqual(idleLoud);
    });

    it("renders a conic-gradient backplate (Siri/Pi-style swirl) for active states", () => {
      const listening = renderToStaticMarkup(<VoiceOrb state="listening" />);
      expect(listening).toContain("voice-orb__conic");
    });

    it("references the conic-gradient spin animation in the colocated styles", () => {
      // The conic gradient interpolates an `<angle>` value — registering it
      // via `@property` is the load-bearing piece that turns a step-wise
      // animation into a smooth swirl. The @property lives in globals.css,
      // so we assert the keyframe reference exists in the colocated block.
      const html = renderToStaticMarkup(<VoiceOrb state="speaking" />);
      expect(html).toContain("voice-orb-conic-spin");
    });
  });

  it("never uses hardcoded Tailwind color classes", () => {
    const states = ["idle", "listening", "speaking", "thinking", "error", "muted"] as const;
    for (const state of states) {
      const html = renderToStaticMarkup(<VoiceOrb state={state} />);
      expect(html).not.toMatch(
        /\b(?:bg|text|ring|border)-(?:red|blue|green|yellow|amber|gray|grey|slate|zinc|emerald|lime|cyan|sky|indigo|violet|purple|pink|orange|rose|teal|fuchsia)-\d{2,3}\b/,
      );
    }
  });

  describe("animation-name CSS — guards against keyframe tree-shake regression", () => {
    /**
     * Tailwind 4's JIT only emits keyframes that are referenced via a
     * registered `--animate-*` theme token OR by a Tailwind utility class.
     * The voice orb references its keyframes ONLY from the colocated
     * `<style>` block, so historically those `@keyframes` rules lived
     * inside `@theme inline {}` in globals.css — where Tailwind silently
     * pruned them because no utility class referenced them by name. That
     * shipped a static blob to prod with zero motion.
     *
     * These tests pin the animation-name references per element. If a
     * future refactor accidentally drops one of the animation references
     * from the colocated `<style>` block (or strips one of the orb
     * keyframes from globals.css), this regression catches it before the
     * orb ships frozen again. We assert the animation-name appears in an
     * `animation:` shorthand value inside the inline style block — the
     * browser resolves that shorthand into the runtime `animation-name`
     * property, so checking the source string is equivalent without
     * having to spin up jsdom + a real CSSStyleDeclaration.
     */

    function inlineStyleBlock(state: "idle" | "listening" | "speaking" | "thinking" | "error" | "muted"): string {
      const html = renderToStaticMarkup(<VoiceOrb state={state} />);
      const match = html.match(/<style[^>]*>([\s\S]*?)<\/style>/);
      return match?.[1] ?? "";
    }

    it("references every voice-orb keyframe the component depends on", () => {
      // The keyframe-reference set in the inline <style> is the same across
      // states (the CSS rules are static; state-specific behaviour is
      // toggled via classes + CSS custom properties). What matters is that
      // every keyframe the component depends on is referenced by name —
      // if any reference goes missing, the matching animation silently
      // disappears at runtime even when the keyframe still exists in
      // globals.css.
      const style = inlineStyleBlock("speaking");
      const expected = [
        "orb-morph",
        "voice-orb-hue",
        "voice-orb-rotate",
        "voice-orb-heart",
        "voice-orb-pulse-halo",
        "voice-orb-float",
        "voice-orb-beat",
        "voice-orb-ripple",
        "voice-orb-spark",
        "voice-orb-halo",
        "voice-orb-conic-spin",
        "voice-orb-particle-orbit",
        "voice-orb-particle-twinkle",
        "voice-orb-ring-rotate",
      ];
      for (const name of expected) {
        expect(style).toContain(name);
      }
    });

    it(".voice-orb--morph applies the orb-morph animation", () => {
      const style = inlineStyleBlock("listening");
      expect(style).toMatch(
        /\.voice-orb--morph\s*\{\s*animation:\s*orb-morph/,
      );
    });

    it(".voice-orb--float layers the float animation on top of morph + hue", () => {
      const style = inlineStyleBlock("listening");
      expect(style).toMatch(
        /\.voice-orb--float\s*\{[\s\S]*?animation:[\s\S]*?voice-orb-float/,
      );
    });

    it(".voice-orb--float.voice-orb--pulse.voice-orb--beat layers the percussive beat animation", () => {
      const style = inlineStyleBlock("speaking");
      expect(style).toMatch(
        /\.voice-orb--float\.voice-orb--pulse\.voice-orb--beat\s*\{[\s\S]*?voice-orb-beat/,
      );
    });

    it(".voice-orb--morph .voice-orb__core runs the inner heart pulse", () => {
      const style = inlineStyleBlock("listening");
      expect(style).toMatch(
        /\.voice-orb--morph\s+\.voice-orb__core\s*\{\s*animation:\s*voice-orb-heart/,
      );
    });

    it(".voice-orb__particle composes orbit + twinkle animations", () => {
      const style = inlineStyleBlock("thinking");
      expect(style).toMatch(
        /\.voice-orb__particle\s*\{[\s\S]*?animation:[\s\S]*?voice-orb-particle-orbit[\s\S]*?voice-orb-particle-twinkle/,
      );
    });

    it(".voice-orb__ring runs the counter-rotating ring animation", () => {
      const style = inlineStyleBlock("thinking");
      expect(style).toMatch(
        /\.voice-orb__ring\s*\{\s*animation:\s*voice-orb-ring-rotate/,
      );
    });

    it(".voice-orb__halo--animated runs the breathing halo opacity animation", () => {
      const style = inlineStyleBlock("listening");
      expect(style).toMatch(
        /\.voice-orb__halo--animated\s*\{\s*animation:\s*voice-orb-halo/,
      );
    });

    it(".voice-orb__conic--animated runs the angle-interpolating spin animation", () => {
      const style = inlineStyleBlock("speaking");
      expect(style).toMatch(
        /\.voice-orb__conic--animated\s*\{\s*animation:\s*voice-orb-conic-spin/,
      );
    });
  });
});
