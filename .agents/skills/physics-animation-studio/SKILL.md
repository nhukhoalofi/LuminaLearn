---
name: physics-animation-studio
description: Design, architect, and render verified 9:16 vertical physics explainer animations in Remotion. Covers ray optics, wave harmonics, thermodynamics, particle kinetics, and Lorentz force fields.
---

# Physics Animation Studio — LuminaLearn Design System

This skill guides the creation of high-fidelity, physically verified educational micro-learning animations for TikTok, YouTube Shorts, and LuminaLearn Web Studio.

## 1. Visual Design Architecture (9:16 Vertical Golden Canvas)

All physics explainer animations MUST adhere strictly to the unified 1080×1920 @ 30 FPS vertical layout:

* **Canvas Dimensions**: `width: 1080, height: 1920` (9:16 aspect ratio).
* **Color Palette**:
  - Background: Deep Obsidian Navy (`#070B14` or radial gradient `radial-gradient(circle at 50% 35%, #0C1626 0%, #070B14 100%)`).
  - Primary Highlight: Electric Cyan (`#38BDF8`) for scientific concepts, lenses, waves, and boundaries.
  - Secondary Highlight: Warm Amber Gold (`#FBBF24`) for key terminology, formulas, and conclusions.
  - Rainbow Spectrum: `['#EF4444', '#F97316', '#FBBF24', '#22C55E', '#06B6D4', '#3B82F6', '#A855F7']`.
  - Mascot Tint: Cyber Silver with cyan visor glow (`#38BDF8`).

## 2. Vertical Zonal Grid (Fixed Coordinates)

```
y = 0 ──── Top Safe Area
y = 80 ─── Header Bar: Dot indicator + "• VẬT LÝ với LuminaLearn" (left) + Category Pill (right)
y = 180 ── End of Header
y = 240 ── Hook Title: 56-58px font, bold 900, keyword highlights in #FBBF24 or #38BDF8
y = 440 ── End of Title Zone
y = 480 ── Central Interactive Simulation Canvas (840×640 px container)
y = 1300 ─ End of Simulation Canvas
y = 1350 ─ Bottom Insight / Takeaway: 36-38px font, bold 700, 2-line maximum
y = 1550 ─ End of Insight Zone
y = 1600 ─ Outro Challenge: "Câu hỏi cho bạn:" + Centered 3D MascotRobot (size 260-320px)
y = 1920 ─ Bottom Edge
```

## 3. Core Physics Simulation Modules (Available Components)

Import directly from `@luminalearn/animation`:

1. **`WaveOscillationCanvas`**:
   - For electromagnetic radiation, acoustic propagation, and radio signals.
   - Harmonic sine waves with animated floating photon quanta, equilibrium line, and wavelength dimension brackets ($\lambda = c/f$).
2. **`ParticleKineticCanvas`**:
   - For thermodynamics, Brownian motion, temperature scaling, and surface condensation (dew point).
   - Elastic bouncing boundary physics with velocity motion trails.
3. **`VectorFieldForceCanvas`**:
   - For classical mechanics and electromagnetic forces.
   - Dynamic free-body force vectors ($\vec{F}_{\text{Lorentz}}$, $\vec{P} = m\vec{g}$, $\vec{N}$, $\vec{F}_{\text{ms}}$) with glowing vector heads.
4. **`GenericPhysicsCanvas`**:
   - Universal adaptive canvas wrapping any physics prompt into the full 9:16 layout.
5. **`MascotRobot`**:
   - Interactive companion robot sitting at the conclusion of every lesson.

## 4. Voiceover & Audio Integration

* **Speech Engine**: DUTAI ZeroTTS (`baotrang` voice, 48kHz WAV stereo).
* **BGM Mixing**: Acoustic guitar trimmed from second 16 onwards, mixed at volume `0.18` (-20dB) with a gentle fade-in (1.5s) and fade-out (2.0s) at the outro.
* **Narration Timing**: Never allow overlapping speech cues; enforce a 150ms natural breath pause between consecutive pedagogical scenes.

