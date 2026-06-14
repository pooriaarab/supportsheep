"use client";
import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

export type VoiceOrbState =
  | "idle"
  | "listening"
  | "speaking"
  | "thinking"
  | "error"
  | "muted";

interface Props {
  state: VoiceOrbState;
  audioLevel?: number; // 0..1
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const SIZES = { sm: 64, md: 128, lg: 192, xl: 256 } as const;

/**
 * Per-state inline style + class fragments. The orb's look is driven by a
 * single CSS variable, `--orb-color`, plus a per-state morph duration. We
 * route both as inline custom properties so each state cleanly fades to the
 * next via the existing `transition-[--orb-color]` rule.
 *
 * The morph itself is driven by smooth `border-radius` percentage tweens
 * (see the `orb-morph` keyframe), not `clip-path` polygons — percentage
 * radii produce continuous organic blob deformations instead of angular
 * polygon vertex transitions.
 *
 * On top of the silhouette morph, an inner-core "heart" pulse runs at a
 * subtly different rhythm than the outer morph (`voice-orb-heart`), a
 * gentle Y-axis float makes the orb feel like it is breathing
 * (`voice-orb-float`), a soft outer halo fades in and out
 * (`voice-orb-halo`), and a slow hue-rotate cycles the accent through a
 * small range over ~12s (`voice-orb-hue`).
 *
 * v3 layers on top:
 *   - a slow rotating conic-gradient backplate that produces a fluid
 *     swirl of accent-tinted colour behind the silhouette (Siri/Pi-style);
 *   - a particle field — small dots orbiting the orb at varying radii
 *     and speeds, denser during `thinking`;
 *   - a counter-rotating ring on `thinking` for a JARVIS-style
 *     "processing" feel;
 *   - audio-amplitude-driven aura — the halo and aura opacity scale with
 *     the live `audioLevel` prop when the AI is speaking or the mic is
 *     listening, so the orb visually pulses with the actual waveform
 *     rather than a fixed cadence.
 *
 * State-specific intensities are tuned per row of `STATE_CONFIG`.
 *
 * States:
 *   - idle: very slow morph (18s), muted, gentle float, no pulse, faint aura
 *   - listening: medium morph (12s), info-blue, slow pulse, brighter rim
 *   - speaking: fast morph (6s), success-green, rhythmic 200ms beat,
 *     ripple ring, bright aura, audio-amplitude-driven halo
 *   - thinking: medium morph (8s) + slow rotation (15s), warning-amber,
 *     pulse, sparks, dense particle field, counter-rotating ring
 *   - error: still (morph paused), destructive-red, no pulse, dim aura
 *   - muted: same baseline as idle but explicitly desaturated
 */
const STATE_CONFIG: Record<
  VoiceOrbState,
  {
    /** CSS color expression referencing a semantic token. */
    color: string;
    /** Morph duration (CSS time). `0s` disables morph entirely. */
    morphDuration: string;
    /** Rotation duration. `0s` disables rotation. */
    rotateDuration: string;
    /** Outer-glow blur radius in px — drives the aura intensity. */
    auraBlur: number;
    /** Outer-glow opacity (0..1). */
    auraOpacity: number;
    /** Whether to render the expanding ripple ring (speaking only). */
    ripple: boolean;
    /** Whether to render the pulse halo (listening/thinking). */
    pulse: boolean;
    /** Pulse animation duration. Tuned per state so cadence reads at a glance. */
    pulseDuration: string;
    /** Inner-core "heart" pulse duration. Offset from the outer morph so the
     * core breathes at its own rhythm instead of locking to the silhouette. */
    heartDuration: string;
    /** Y-axis float (bob) duration. `0s` disables the float. */
    floatDuration: string;
    /** Float vertical travel in px (peak negative Y). */
    floatTravel: number;
    /** Outer halo fade duration. `0s` disables halo motion. */
    haloDuration: string;
    /** Halo peak opacity (0..1) — drives the brightest moment of the cycle. */
    haloOpacity: number;
    /** Whether to render the "thinking" sparks. */
    sparks: boolean;
    /** Whether to apply the rhythmic 200ms-beat speaking pulse override. */
    beat: boolean;
    /** Conic-gradient backplate spin duration. `0s` disables the backplate. */
    conicDuration: string;
    /** Conic-gradient backplate opacity (0..1). */
    conicOpacity: number;
    /** Particle count — how many orbiting dots to render. 0 disables. */
    particleCount: number;
    /** Particle orbit duration in seconds. Slower = calmer. */
    particleDuration: number;
    /** Whether to render the counter-rotating "thinking" ring. */
    ring: boolean;
  }
> = {
  idle: {
    color: "var(--muted-foreground)",
    morphDuration: "18s",
    rotateDuration: "0s",
    auraBlur: 40,
    auraOpacity: 0.25,
    ripple: false,
    pulse: false,
    pulseDuration: "0s",
    heartDuration: "9s",
    floatDuration: "4s",
    floatTravel: 3,
    haloDuration: "6s",
    haloOpacity: 0.4,
    sparks: false,
    beat: false,
    conicDuration: "40s",
    conicOpacity: 0.15,
    particleCount: 6,
    particleDuration: 24,
    ring: false,
  },
  listening: {
    color: "var(--info)",
    morphDuration: "12s",
    rotateDuration: "0s",
    auraBlur: 80,
    auraOpacity: 0.55,
    ripple: false,
    pulse: true,
    pulseDuration: "2.4s",
    heartDuration: "3.6s",
    floatDuration: "4s",
    floatTravel: 3,
    haloDuration: "4s",
    haloOpacity: 0.7,
    sparks: false,
    beat: false,
    conicDuration: "24s",
    conicOpacity: 0.3,
    particleCount: 8,
    particleDuration: 18,
    ring: false,
  },
  speaking: {
    color: "var(--success)",
    morphDuration: "6s",
    rotateDuration: "0s",
    auraBlur: 100,
    auraOpacity: 0.75,
    ripple: true,
    pulse: true,
    pulseDuration: "0.9s",
    heartDuration: "1.4s",
    floatDuration: "3.2s",
    floatTravel: 4,
    haloDuration: "2.4s",
    haloOpacity: 0.75,
    sparks: false,
    beat: true,
    conicDuration: "14s",
    conicOpacity: 0.4,
    particleCount: 10,
    particleDuration: 12,
    ring: false,
  },
  thinking: {
    color: "var(--warning)",
    morphDuration: "8s",
    rotateDuration: "15s",
    auraBlur: 90,
    auraOpacity: 0.65,
    ripple: false,
    pulse: true,
    pulseDuration: "1.4s",
    heartDuration: "2.2s",
    floatDuration: "3.6s",
    floatTravel: 4,
    haloDuration: "3s",
    haloOpacity: 0.7,
    sparks: true,
    beat: false,
    conicDuration: "10s",
    conicOpacity: 0.45,
    particleCount: 16,
    particleDuration: 8,
    ring: true,
  },
  error: {
    color: "var(--destructive)",
    morphDuration: "0s",
    rotateDuration: "0s",
    auraBlur: 30,
    auraOpacity: 0.2,
    ripple: false,
    pulse: false,
    pulseDuration: "0s",
    heartDuration: "0s",
    floatDuration: "0s",
    floatTravel: 0,
    haloDuration: "0s",
    haloOpacity: 0.25,
    sparks: false,
    beat: false,
    conicDuration: "0s",
    conicOpacity: 0,
    particleCount: 0,
    particleDuration: 0,
    ring: false,
  },
  muted: {
    color: "var(--muted-foreground)",
    morphDuration: "18s",
    rotateDuration: "0s",
    auraBlur: 35,
    auraOpacity: 0.2,
    ripple: false,
    pulse: false,
    pulseDuration: "0s",
    heartDuration: "9s",
    floatDuration: "4s",
    floatTravel: 2,
    haloDuration: "6s",
    haloOpacity: 0.35,
    sparks: false,
    beat: false,
    conicDuration: "40s",
    conicOpacity: 0.1,
    particleCount: 4,
    particleDuration: 28,
    ring: false,
  },
};

interface OrbCssVars extends CSSProperties {
  "--orb-color": string;
  "--orb-morph-duration": string;
  "--orb-rotate-duration": string;
  "--orb-aura-blur": string;
  "--orb-aura-opacity": string;
  "--orb-pulse-duration": string;
  "--orb-heart-duration": string;
  "--orb-float-duration": string;
  "--orb-float-travel": string;
  "--orb-halo-duration": string;
  "--orb-halo-opacity": string;
  "--orb-audio-scale": string;
  "--orb-audio-transform": string;
  "--orb-conic-duration": string;
  "--orb-conic-opacity": string;
}

interface ParticleCssVars extends CSSProperties {
  "--orb-particle-radius": string;
  "--orb-particle-delay": string;
  "--orb-particle-duration": string;
  "--orb-particle-size": string;
  "--orb-particle-min-opacity": string;
  "--orb-particle-max-opacity": string;
}

/**
 * Deterministic per-particle parameters. We avoid `Math.random()` so server-
 * rendered markup matches the client and successive renders produce the
 * same orbital layout. Each particle picks an angle, radius, size and
 * twinkle range from these arrays modulo its index.
 */
const PARTICLE_RADII = [38, 45, 52, 41, 48, 55, 36, 50, 43, 47, 54, 39, 46, 51, 44, 49];
const PARTICLE_SIZES = [3, 2, 4, 2.5, 3.5, 2, 3, 2.5];
const PARTICLE_DELAY_FRAC = [0, 0.12, 0.28, 0.41, 0.55, 0.66, 0.78, 0.89, 0.05, 0.18, 0.33, 0.47, 0.6, 0.72, 0.84, 0.95];

/**
 * "Alive" CSS-only animated voice orb. Layers, from back to front:
 *
 *   1. `.voice-orb__conic` — slow rotating conic-gradient backplate that
 *      paints fluid accent-tinted swirls behind the silhouette. Driven by
 *      a registered `--orb-angle` custom property so the gradient stops
 *      interpolate smoothly (Siri/Pi-style colour flow).
 *   2. `.voice-orb__halo` — a soft outer radial glow that fades opacity
 *      in/out on its own cadence so the orb always feels like it is
 *      radiating energy. Halo opacity is also boosted by the live
 *      `audioLevel` prop so the glow reacts to real audio amplitude.
 *   3. `.voice-orb__particles` — orbiting dot field; per-particle radius,
 *      angle, twinkle range and orbit duration are routed through CSS
 *      custom properties so a single keyframe drives the whole cluster.
 *   4. `.voice-orb` — the morphing silhouette, driven by smooth
 *      `border-radius` percentage tweens (`orb-morph`) and a slow
 *      `voice-orb-hue` filter cycle that drifts the accent color through
 *      a small hue range over ~12s. A gentle `voice-orb-float` Y-axis
 *      bob runs on the same element so the whole shape breathes.
 *   5. `.voice-orb::before` / `::after` — two extra blob layers offset
 *      from the main silhouette to give the morph depth.
 *   6. `.voice-orb__core` — the inner "heart": a tighter radial gradient
 *      that pulses scale + opacity on its own rhythm via
 *      `voice-orb-heart`, intentionally not synchronized with the outer
 *      morph so the orb reads as alive instead of mechanical.
 *   7. `.voice-orb__ring` — counter-rotating thin ring rendered only
 *      during `thinking`. A conic-gradient masked into a ring shape
 *      that spins opposite to the conic backplate for a JARVIS-style
 *      "processing" feel.
 *
 * State changes fade across the `--orb-color` CSS variable (500ms ease-out),
 * so transitioning between listening → speaking → thinking feels like a
 * continuous shift in mood rather than a hard color swap.
 * `prefers-reduced-motion` strips morph + rotation + pulse + heart + float
 * + halo + hue + sparks + beat + conic spin + particle orbit + ring,
 * leaving only the color change.
 */
export function VoiceOrb({
  state,
  audioLevel = 0,
  size = "lg",
  className,
}: Props) {
  const px = SIZES[size];
  const config = STATE_CONFIG[state];

  // Clamp audio level to 0..1 once so every downstream computation reads
  // from a single normalized value.
  const clampedAudio = Math.min(Math.max(audioLevel, 0), 1);

  // Audio-reactive subtle scale on speaking/listening, capped at 1.12 so the
  // orb breathes without clipping its aura against the container edge.
  // Routed via CSS variable so the float keyframe can compose translateY()
  // with scale() in the same `transform` channel.
  const audioScale =
    state === "speaking" || state === "listening"
      ? 1 + clampedAudio * 0.12
      : 1;

  // Audio-reactive halo + aura opacity boost. During speaking/listening,
  // the live amplitude scales the halo and aura up to +60% beyond the
  // state's baseline so the glow visibly pulses with the waveform rather
  // than only via the scale transform. Outside those states, audio is
  // ignored (the value defaults to baseline).
  const audioBoost =
    state === "speaking" || state === "listening" ? clampedAudio * 0.6 : 0;
  const reactiveHaloOpacity = Math.min(
    1,
    config.haloOpacity * (1 + audioBoost),
  );
  const reactiveAuraOpacity = Math.min(
    1,
    config.auraOpacity * (1 + audioBoost * 0.5),
  );

  const cssVars: OrbCssVars = {
    "--orb-color": config.color,
    "--orb-morph-duration": config.morphDuration,
    "--orb-rotate-duration": config.rotateDuration,
    "--orb-aura-blur": `${config.auraBlur}px`,
    "--orb-aura-opacity": String(reactiveAuraOpacity),
    "--orb-pulse-duration": config.pulseDuration,
    "--orb-heart-duration": config.heartDuration,
    "--orb-float-duration": config.floatDuration,
    "--orb-float-travel": `${config.floatTravel}px`,
    "--orb-halo-duration": config.haloDuration,
    "--orb-halo-opacity": String(reactiveHaloOpacity),
    "--orb-audio-scale": String(audioScale),
    "--orb-audio-transform": `scale(${audioScale})`,
    "--orb-conic-duration": config.conicDuration,
    "--orb-conic-opacity": String(config.conicOpacity),
  };

  return (
    <div
      className={cn("voice-orb-root inline-flex flex-col items-center gap-3", className)}
      style={cssVars}
    >
      <div
        className="voice-orb-stage relative grid place-items-center"
        style={{ width: px, height: px }}
      >
        {config.conicOpacity > 0 && (
          <span
            aria-hidden="true"
            className={cn(
              "voice-orb__conic",
              config.conicDuration !== "0s" && "voice-orb__conic--animated",
            )}
          />
        )}
        <span
          aria-hidden="true"
          className={cn(
            "voice-orb__halo",
            config.haloDuration !== "0s" && "voice-orb__halo--animated",
          )}
        />
        {config.particleCount > 0 && (
          <span
            aria-hidden="true"
            className="voice-orb__particles"
            data-particle-count={config.particleCount}
          >
            {Array.from({ length: config.particleCount }, (_, i) => {
              const radius = PARTICLE_RADII[i % PARTICLE_RADII.length] ?? 45;
              const sizeBase = PARTICLE_SIZES[i % PARTICLE_SIZES.length] ?? 3;
              const delayFrac = PARTICLE_DELAY_FRAC[i % PARTICLE_DELAY_FRAC.length] ?? 0;
              // Negative delay so animations start mid-cycle — particles
              // appear pre-distributed around their orbits at first paint
              // instead of all spawning at angle 0 simultaneously.
              const delaySec = -delayFrac * config.particleDuration;
              const particleVars: ParticleCssVars = {
                "--orb-particle-radius": `${radius}%`,
                "--orb-particle-delay": `${delaySec}s`,
                "--orb-particle-duration": `${config.particleDuration}s`,
                "--orb-particle-size": `${sizeBase}px`,
                "--orb-particle-min-opacity": "0.2",
                "--orb-particle-max-opacity": "0.7",
              };
              return (
                <span
                  key={i}
                  className="voice-orb__particle"
                  style={particleVars}
                />
              );
            })}
          </span>
        )}
        <div
          data-state={state}
          aria-label={`Voice orb: ${state}`}
          className={cn(
            "voice-orb absolute inset-0 grid place-items-center",
            config.pulse && "voice-orb--pulse",
            config.ripple && "voice-orb--ripple",
            config.rotateDuration !== "0s" && "voice-orb--rotate",
            config.morphDuration !== "0s" && "voice-orb--morph",
            config.floatDuration !== "0s" && "voice-orb--float",
            config.sparks && "voice-orb--sparks",
            config.beat && "voice-orb--beat",
          )}
        >
          <span className="voice-orb__core" aria-hidden="true" />
        </div>
        {config.ring && (
          <span aria-hidden="true" className="voice-orb__ring" />
        )}
      </div>

      <VoiceOrbStyles />
    </div>
  );
}

/**
 * Scoped <style> block colocated with the component. Keeps the keyframes
 * and pseudo-element rules in the same file as the markup that depends on
 * them so a single import gives a caller a fully styled orb without having
 * to remember to import a separate CSS file. Keyframe definitions live in
 * `apps/web/src/app/globals.css` so they participate in Tailwind's
 * @theme registry; the rules below reference them by name and gate the
 * animations behind `prefers-reduced-motion: no-preference`.
 */
function VoiceOrbStyles() {
  return (
    <style>{`
      .voice-orb-root {
        --orb-color: var(--muted-foreground);
      }
      .voice-orb-stage {
        position: relative;
      }
      .voice-orb {
        border-radius: 63% 37% 54% 46% / 55% 48% 52% 45%;
        background:
          radial-gradient(circle at 35% 30%,
            color-mix(in oklab, var(--orb-color) 65%, white) 0%,
            color-mix(in oklab, var(--orb-color) 40%, transparent) 35%,
            transparent 70%),
          radial-gradient(circle at 70% 65%,
            color-mix(in oklab, var(--orb-color) 50%, white) 0%,
            color-mix(in oklab, var(--orb-color) 25%, transparent) 40%,
            transparent 75%),
          radial-gradient(circle at 50% 50%,
            color-mix(in oklab, var(--orb-color) 80%, black) 0%,
            color-mix(in oklab, var(--orb-color) 60%, transparent) 60%,
            transparent 100%);
        box-shadow:
          inset 0 0 60px color-mix(in oklab, var(--orb-color) 55%, transparent),
          inset 0 0 20px color-mix(in oklab, var(--orb-color) 75%, white),
          0 0 calc(var(--orb-aura-blur) * 0.6) color-mix(in oklab, var(--orb-color) calc(var(--orb-aura-opacity) * 100%), transparent),
          0 0 var(--orb-aura-blur) color-mix(in oklab, var(--orb-color) calc(var(--orb-aura-opacity) * 40%), transparent),
          0 0 calc(var(--orb-aura-blur) * 2) color-mix(in oklab, var(--orb-color) calc(var(--orb-aura-opacity) * 20%), transparent);
        transform: var(--orb-audio-transform, scale(1));
        transition:
          background-color 500ms ease-out,
          box-shadow 500ms ease-out,
          transform 500ms ease-out;
        will-change: transform, border-radius, filter;
      }
      .voice-orb__core {
        position: absolute;
        inset: 12%;
        border-radius: 50% 60% 40% 70% / 60% 40% 70% 50%;
        background:
          radial-gradient(circle at 50% 50%,
            color-mix(in oklab, var(--orb-color) 85%, white) 0%,
            color-mix(in oklab, var(--orb-color) 50%, transparent) 35%,
            color-mix(in oklab, var(--orb-color) 20%, transparent) 65%,
            transparent 85%);
        opacity: 0.75;
        mix-blend-mode: screen;
        transform: scale(1);
        will-change: transform, opacity;
      }
      .voice-orb::before,
      .voice-orb::after {
        content: "";
        position: absolute;
        inset: 0;
        border-radius: inherit;
        pointer-events: none;
      }
      .voice-orb::before {
        background: radial-gradient(circle at 60% 40%,
          color-mix(in oklab, var(--orb-color) 45%, white) 0%,
          transparent 55%);
        opacity: 0.55;
        mix-blend-mode: screen;
      }
      .voice-orb::after {
        background: radial-gradient(circle at 25% 75%,
          color-mix(in oklab, var(--orb-color) 35%, white) 0%,
          transparent 60%);
        opacity: 0.4;
        mix-blend-mode: screen;
      }

      /* Soft outer halo. A larger-than-orb radial glow that fades in/out
         on its own cadence so the silhouette always feels surrounded by
         radiating energy regardless of state-specific aura intensity.
         Halo peak opacity is amplitude-reactive — the inline
         --orb-halo-opacity already includes the live audio boost. */
      .voice-orb__halo {
        position: absolute;
        inset: -18%;
        border-radius: 50%;
        background: radial-gradient(circle at 50% 50%,
          color-mix(in oklab, var(--orb-color) 55%, transparent) 0%,
          color-mix(in oklab, var(--orb-color) 25%, transparent) 30%,
          transparent 70%);
        filter: blur(calc(var(--orb-aura-blur) * 0.35));
        opacity: calc(var(--orb-halo-opacity, 0.4) * 0.6);
        pointer-events: none;
        mix-blend-mode: screen;
        will-change: opacity;
        transition: opacity 200ms linear;
      }

      /* Rotating conic-gradient backplate. Three conic-gradients at
         different anchor points multiplied by --orb-angle at varying
         signs/multipliers produce a fluid swirl of accent-tinted colour
         (Siri/Pi-style). filter: blur+contrast melts the sharp gradient
         seams into smooth blobs. mix-blend-mode: screen layers the swirl
         on top of the page background without darkening it. */
      .voice-orb__conic {
        position: absolute;
        inset: -10%;
        border-radius: 50%;
        background:
          conic-gradient(
            from calc(var(--orb-angle, 0deg) * 2) at 25% 70%,
            color-mix(in oklab, var(--orb-color) 70%, white),
            transparent 20% 80%,
            color-mix(in oklab, var(--orb-color) 70%, white)
          ),
          conic-gradient(
            from calc(var(--orb-angle, 0deg) * -3) at 80% 20%,
            color-mix(in oklab, var(--orb-color) 60%, white),
            transparent 30% 60%,
            color-mix(in oklab, var(--orb-color) 60%, white)
          ),
          conic-gradient(
            from calc(var(--orb-angle, 0deg) * 1) at 50% 50%,
            color-mix(in oklab, var(--orb-color) 50%, transparent),
            transparent 40% 60%,
            color-mix(in oklab, var(--orb-color) 50%, transparent)
          );
        filter: blur(18px) contrast(1.4);
        opacity: var(--orb-conic-opacity, 0.3);
        mix-blend-mode: screen;
        pointer-events: none;
        will-change: --orb-angle;
        transition: opacity 500ms ease-out;
      }

      /* Particle field container — fills the stage so children can use
         percentage-based orbital radii relative to the orb's own size. */
      .voice-orb__particles {
        position: absolute;
        inset: 0;
        pointer-events: none;
      }
      .voice-orb__particle {
        position: absolute;
        top: 50%;
        left: 50%;
        width: var(--orb-particle-size, 3px);
        height: var(--orb-particle-size, 3px);
        margin-top: calc(var(--orb-particle-size, 3px) * -0.5);
        margin-left: calc(var(--orb-particle-size, 3px) * -0.5);
        border-radius: 50%;
        background: color-mix(in oklab, var(--orb-color) 85%, white);
        box-shadow: 0 0 6px color-mix(in oklab, var(--orb-color) 60%, transparent);
        opacity: var(--orb-particle-min-opacity, 0.4);
        transform-origin: center;
        will-change: transform, opacity;
      }

      /* Counter-rotating thinking-state ring. conic-gradient produces a
         single sweep that we then mask into an outline-only ring shape
         with a radial-gradient mask (donut hole + outer cutoff). */
      .voice-orb__ring {
        position: absolute;
        inset: -6%;
        border-radius: 50%;
        background: conic-gradient(
          from 0deg,
          transparent 0deg,
          color-mix(in oklab, var(--orb-color) 80%, white) 90deg,
          transparent 180deg,
          color-mix(in oklab, var(--orb-color) 60%, white) 270deg,
          transparent 360deg
        );
        -webkit-mask: radial-gradient(
          circle at 50% 50%,
          transparent 0%,
          transparent 48%,
          black 50%,
          black 52%,
          transparent 54%
        );
        mask: radial-gradient(
          circle at 50% 50%,
          transparent 0%,
          transparent 48%,
          black 50%,
          black 52%,
          transparent 54%
        );
        pointer-events: none;
        mix-blend-mode: screen;
        opacity: 0.7;
      }

      @media (prefers-reduced-motion: no-preference) {
        .voice-orb--morph {
          animation:
            orb-morph var(--orb-morph-duration) ease-in-out infinite,
            voice-orb-hue 12s linear infinite;
        }
        /* Layer the same morph on the pseudo-elements with -1s and -2s
           negative delays so each silhouette layer is at a different phase
           of the keyframe — this stacks three subtly out-of-sync organic
           blobs on top of each other for depth without ever showing a hard
           transition. */
        .voice-orb--morph::before {
          animation: orb-morph var(--orb-morph-duration) ease-in-out infinite;
          animation-delay: -1s;
        }
        .voice-orb--morph::after {
          animation: orb-morph var(--orb-morph-duration) ease-in-out infinite;
          animation-delay: -2s;
        }
        /* Inner-core "heart" pulse — runs whenever the morph is active so
           the orb's centre breathes on its own rhythm independent of the
           outer silhouette. Slightly offset duration vs. the outer morph
           keeps the two layers from locking phase. */
        .voice-orb--morph .voice-orb__core {
          animation: voice-orb-heart var(--orb-heart-duration) ease-in-out infinite;
        }
        .voice-orb--rotate .voice-orb__core {
          animation:
            voice-orb-rotate var(--orb-rotate-duration) linear infinite,
            voice-orb-heart var(--orb-heart-duration) ease-in-out infinite;
        }
        /* Pulse halo runs alongside the morph as a stacked animation
           shorthand value so the keyframed box-shadow ring composes
           cleanly with the silhouette deformation on the same element.
           The hue cycle is also stacked so colour drift remains active. */
        .voice-orb--pulse {
          animation:
            orb-morph var(--orb-morph-duration) ease-in-out infinite,
            voice-orb-hue 12s linear infinite,
            voice-orb-pulse-halo var(--orb-pulse-duration) ease-out infinite;
        }
        /* Gentle Y-axis bob — composed into the same transform property as
           audio-reactive scale by routing scale through a CSS variable. */
        .voice-orb--float {
          animation:
            orb-morph var(--orb-morph-duration) ease-in-out infinite,
            voice-orb-hue 12s linear infinite,
            voice-orb-float var(--orb-float-duration) ease-in-out infinite;
        }
        .voice-orb--float.voice-orb--pulse {
          animation:
            orb-morph var(--orb-morph-duration) ease-in-out infinite,
            voice-orb-hue 12s linear infinite,
            voice-orb-pulse-halo var(--orb-pulse-duration) ease-out infinite,
            voice-orb-float var(--orb-float-duration) ease-in-out infinite;
        }
        /* Speaking state: rhythmic 200ms beat layered on top of every
           other animation so audio output reads as percussive pulses.
           Compound selector ensures it overrides .voice-orb--float.voice-orb--pulse. */
        .voice-orb--float.voice-orb--pulse.voice-orb--beat {
          animation:
            orb-morph var(--orb-morph-duration) ease-in-out infinite,
            voice-orb-hue 12s linear infinite,
            voice-orb-pulse-halo var(--orb-pulse-duration) ease-out infinite,
            voice-orb-float var(--orb-float-duration) ease-in-out infinite,
            voice-orb-beat 200ms ease-in-out infinite;
        }
        .voice-orb--ripple::after {
          animation:
            orb-morph var(--orb-morph-duration) ease-in-out infinite,
            voice-orb-ripple 1.6s ease-out infinite;
          animation-delay: -2s, 0s;
        }
        /* Thinking-state "spark" particles. Drawn purely with the orb's
           ::before pseudo-element via a multi-stop radial-gradient burst
           and animated with the voice-orb-spark keyframe so the points
           drift outward and fade. Sparks compose with the existing
           ::before blob layer by stacking another background image. */
        .voice-orb--sparks::before {
          background:
            radial-gradient(2px 2px at 20% 30%,
              color-mix(in oklab, var(--orb-color) 80%, white) 0%,
              transparent 100%),
            radial-gradient(1.5px 1.5px at 75% 25%,
              color-mix(in oklab, var(--orb-color) 70%, white) 0%,
              transparent 100%),
            radial-gradient(2px 2px at 65% 80%,
              color-mix(in oklab, var(--orb-color) 75%, white) 0%,
              transparent 100%),
            radial-gradient(1.5px 1.5px at 30% 75%,
              color-mix(in oklab, var(--orb-color) 70%, white) 0%,
              transparent 100%),
            radial-gradient(circle at 60% 40%,
              color-mix(in oklab, var(--orb-color) 45%, white) 0%,
              transparent 55%);
          animation:
            orb-morph var(--orb-morph-duration) ease-in-out infinite,
            voice-orb-spark 2.4s ease-in-out infinite;
          animation-delay: -1s, 0s;
        }
        .voice-orb__halo--animated {
          animation: voice-orb-halo var(--orb-halo-duration) ease-in-out infinite;
        }
        .voice-orb__conic--animated {
          animation: voice-orb-conic-spin var(--orb-conic-duration) linear infinite;
        }
        .voice-orb__particle {
          animation:
            voice-orb-particle-orbit var(--orb-particle-duration, 18s) linear infinite,
            voice-orb-particle-twinkle calc(var(--orb-particle-duration, 18s) * 0.35) ease-in-out infinite;
          animation-delay: var(--orb-particle-delay, 0s), var(--orb-particle-delay, 0s);
        }
        .voice-orb__ring {
          animation: voice-orb-ring-rotate 6s linear infinite;
        }
      }
    `}</style>
  );
}
