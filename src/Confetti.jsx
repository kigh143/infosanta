import { forwardRef, useImperativeHandle, useRef } from "react";
import { reduceMotion } from "./motion";

// Full-screen Lottie confetti overlay. Call ref.current.fire() to play it.
// lottie-web and the animation JSON are loaded on first use only.
const Confetti = forwardRef(function Confetti(_, ref) {
  const box = useRef(null);
  const anim = useRef(null);

  useImperativeHandle(ref, () => ({
    async fire() {
      if (reduceMotion() || !box.current) return;
      try {
        if (!anim.current) {
          const [{ default: lottie }, { default: data }] = await Promise.all([
            import("lottie-web/build/player/lottie_light"),
            import("./assets/confetti.json"),
          ]);
          anim.current = lottie.loadAnimation({
            container: box.current,
            renderer: "svg",
            loop: false,
            autoplay: false,
            animationData: data,
            rendererSettings: { preserveAspectRatio: "xMidYMid slice" },
          });
          anim.current.addEventListener("complete", () => box.current?.classList.remove("on"));
        }
        box.current.classList.add("on");
        anim.current.goToAndPlay(0, true);
      } catch {
        /* confetti is decoration only */
      }
    },
  }));

  return <div ref={box} className="confetti" aria-hidden="true" />;
});

export default Confetti;
