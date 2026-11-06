import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import type { HTMLMotionProps } from "framer-motion";

const styles = {
  wrapper: {
    display: "inline-block",
    whiteSpace: "pre-wrap",
  },
  srOnly: {
    position: "absolute",
    width: "1px",
    height: "1px",
    padding: 0,
    margin: "-1px",
    overflow: "hidden",
    clip: "rect(0,0,0,0)",
    border: 0,
  },
  jitterStyle: {
    animation: "jitter 0.3s infinite",
  },
};

// Inject the keyframes directly in a <style> tag (you could also use styled-components or global CSS)
if (typeof window !== "undefined") {
  const styleId = "jitter-keyframes";
  if (!document.getElementById(styleId)) {
    const style = document.createElement("style");
    style.id = styleId;
    style.innerHTML = `
        @keyframes jitter {
            0%, 100% { transform: translate(0, 0); }
            20% { transform: translate(-1px, 1px); }
            40% { transform: translate(1px, -1px); }
            60% { transform: translate(-1px, -1px); }
            80% { transform: translate(1px, 1px); }
        }`;
    document.head.appendChild(style);
  }
}

interface DecryptedTextProps extends HTMLMotionProps<"span"> {
  text: string;
  speed?: number;
  maxIterations?: number;
  sequential?: boolean;
  revealDirection?: "start" | "end" | "center";
  useOriginalCharsOnly?: boolean;
  characters?: string;
  className?: string;
  parentClassName?: string;
  encryptedClassName?: string;
  animateOn?: "view" | "hover";
}

type CharState = {
  char: string;
  revealed: boolean;
  iteration: number;
};

export default function DecryptedText({
  text,
  speed = 50,
  maxIterations = 10,
  characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!@#$%^&*()_+",
  className = "",
  parentClassName = "",
  encryptedClassName = "",
  animateOn = "hover",
  ...props
}: DecryptedTextProps) {
  const [charStates, setCharStates] = useState<CharState[]>(
    text.split("").map((char) => ({ char, revealed: false, iteration: 0 })),
  );
  const [isHovering, setIsHovering] = useState(false);
  const [hasAnimated, setHasAnimated] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);

  const scrambleChar = (original: string): string => {
    return original === " "
      ? " "
      : characters[Math.floor(Math.random() * characters.length)];
  };

  useEffect(() => {
    if (!isHovering) return;

    let index = 0;
    const interval = setInterval(() => {
      setCharStates((prev) => {
        const newState = [...prev];
        for (let i = 0; i < newState.length; i++) {
          const c = newState[i];
          if (!c.revealed && i <= index) {
            if (c.iteration >= maxIterations) {
              c.revealed = true;
            } else {
              c.iteration += 1;
            }
            break;
          }
        }

        // Une fois qu’on a fini de révéler tous les caractères
        if (newState.every((c) => c.revealed)) {
          clearInterval(interval);
        }

        return newState;
      });

      index++;
    }, speed);

    return () => clearInterval(interval);
  }, [isHovering]);

  useEffect(() => {
    if (animateOn !== "view") return;

    const observerCallback = (entries: IntersectionObserverEntry[]) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !hasAnimated) {
          setIsHovering(true);
          setHasAnimated(true);
        }
      });
    };

    const observer = new IntersectionObserver(observerCallback, {
      threshold: 0.1,
    });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      if (containerRef.current) {
        observer.unobserve(containerRef.current);
      }
    };
  }, [animateOn, hasAnimated]);

  const hoverProps =
    animateOn === "hover"
      ? {
          onMouseEnter: () => setIsHovering(true),
          onMouseLeave: () => setIsHovering(false),
        }
      : {};

  return (
    <motion.span
      className={parentClassName}
      ref={containerRef}
      style={styles.wrapper}
      {...hoverProps}
      {...props}
    >
      <span style={styles.srOnly}>{text}</span>
      <span aria-hidden="true">
        {charStates.map((c, i) => {
          const displayChar = c.revealed ? c.char : scrambleChar(c.char);

          return (
            <span
              key={i}
              className={c.revealed ? className : encryptedClassName}
              style={c.revealed ? undefined : styles.jitterStyle}
            >
              {displayChar}
            </span>
          );
        })}
      </span>
    </motion.span>
  );
}
