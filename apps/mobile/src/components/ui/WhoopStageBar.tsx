/**
 * WhoopStageBar
 *
 * Whoop sleep-stage tile bar, two modes (screenshots: normal + explosion).
 *
 * NORMAL (selectedStage === null):
 *   ███████░░░░░░░░░░░  ← solid colour fill = this stage's minutes
 *   The x-axis is shared across every tile (0 → total sleep minutes), so
 *   an equal width always means equal minutes (scale-true). The unfilled
 *   remainder is a clearly visible diagonal hatch. The optimal range is a
 *   box, taller than the fill bar, with a faint grey backing fill behind
 *   it and a white dashed outline on top — exactly Whoop's treatment.
 *
 * EXPLOSION (exploded === true):
 *   ░░██░░░██░██░░░░██  ← the bar becomes a TIME axis spanning the whole
 *   night; coloured blocks mark every interval the user spent in THIS
 *   stage, with hatch in the gaps. All tiles explode at once; the parent
 *   dims the non-selected ones.
 *
 * SVG-only — many instances on screen.
 */
import React from "react";
import Svg, { Defs, Line, Pattern, Rect } from "react-native-svg";
import { View } from "react-native";

export interface ExplosionSegment {
  start: number; // epoch ms
  end: number; // epoch ms
}

interface Props {
  value: number; // this stage's minutes (normal mode)
  max: number; // shared axis max = total sleep minutes
  typicalRange?: [number, number] | null; // minutes [lo, hi]
  color: string;
  width?: number;
  height?: number;
  exploded?: boolean;
  segments?: ExplosionSegment[];
  nightStart?: number; // epoch ms
  nightEnd?: number; // epoch ms
}

const BAR_H = 8;
const BOX_H = 16;

export function WhoopStageBar({
  value,
  max,
  typicalRange,
  color,
  width = 132,
  height = 18,
  exploded = false,
  segments,
  nightStart,
  nightEnd,
}: Props) {
  const safeMax = Math.max(1, max);
  const toX = (v: number) => Math.max(0, Math.min(1, v / safeMax)) * width;

  const barY = height / 2 - BAR_H / 2;
  const boxY = height / 2 - BOX_H / 2;

  const rawId = React.useId();
  const hatchId = `hatch${rawId.replace(/[^a-zA-Z0-9]/g, "")}`;

  const canExplode =
    exploded &&
    segments &&
    segments.length > 0 &&
    typeof nightStart === "number" &&
    typeof nightEnd === "number" &&
    nightEnd > nightStart;

  const blocks = canExplode
    ? segments!.map((s, i) => {
        const span = nightEnd! - nightStart!;
        const x = ((s.start - nightStart!) / span) * width;
        const w = Math.max(1.5, ((s.end - s.start) / span) * width);
        return { key: `b-${i}`, x: Math.max(0, x), w };
      })
    : [];

  const fillW = Math.max(2, toX(value));
  const boxX = typicalRange ? toX(typicalRange[0]) : 0;
  const boxW = typicalRange ? Math.max(3, toX(typicalRange[1]) - toX(typicalRange[0])) : 0;

  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height}>
        <Defs>
          <Pattern
            id={hatchId}
            patternUnits="userSpaceOnUse"
            width={5}
            height={5}
            patternTransform="rotate(-45)"
          >
            <Line x1="0" y1="0" x2="0" y2="5" stroke="rgba(255,255,255,0.22)" strokeWidth="1.6" />
          </Pattern>
        </Defs>

        {/* Hatched track (full width, clearly visible) */}
        <Rect x={0} y={barY} width={width} height={BAR_H} rx={BAR_H / 2} fill={`url(#${hatchId})`} />

        {canExplode ? (
          /* Explosion: time blocks for this stage */
          blocks.map((b) => (
            <Rect
              key={b.key}
              x={b.x}
              y={barY}
              width={b.w}
              height={BAR_H}
              rx={2}
              fill={color}
            />
          ))
        ) : (
          <>
            {/* Optimal-range backing (grey, behind the dashed outline) */}
            {typicalRange ? (
              <Rect
                x={boxX}
                y={boxY}
                width={boxW}
                height={BOX_H}
                rx={3}
                fill="rgba(255,255,255,0.10)"
              />
            ) : null}

            {/* Solid colour fill */}
            <Rect x={0} y={barY} width={fillW} height={BAR_H} rx={BAR_H / 2} fill={color} />

            {/* Optimal-range dashed outline (taller, on top) */}
            {typicalRange ? (
              <Rect
                x={boxX}
                y={boxY}
                width={boxW}
                height={BOX_H}
                rx={3}
                fill="none"
                stroke="#FFFFFF"
                strokeOpacity={0.9}
                strokeWidth={1}
                strokeDasharray="2.5,2"
              />
            ) : null}
          </>
        )}
      </Svg>
    </View>
  );
}
