import type { FC } from "react";
import { Composition } from "remotion";
import { Expressions } from "./Expressions";
import { Launch } from "./Launch";
import { END, FPS, HEIGHT, WIDTH } from "./timeline";
import { END as REEL_END } from "./reel";

export const RemotionRoot: FC = () => (
  <>
    <Composition
      id="Launch"
      component={Launch}
      durationInFrames={END}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
    />
    {/* The expressions announce. Same stage, same clock, same creature. */}
    <Composition
      id="Expressions"
      component={Expressions}
      durationInFrames={REEL_END}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
    />
  </>
);
