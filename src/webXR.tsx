import { Button, cn } from "@3dverse/ui-lib";
import { useState, useEffect } from "react";
import { WebXR } from "@3dverse/livelink-webxr";

// Explicitly type the WebXR mode strings
type XRSessionMode = "inline" | "immersive-vr" | "immersive-ar";

export function XRButton({
    mode,
    setXRMode,
    text = "Enter",
}: {
    mode: XRSessionMode;
    text?: string;
    setXRMode: (mode: XRSessionMode) => void;
}) {
    const [isSessionSupported, setIsSessionSupported] = useState(false);
    const [message, setMessage] = useState("");
    const xrModeTitle = mode.endsWith("ar") ? "AR" : "VR";

    useEffect(() => {
        if (!window.isSecureContext) {
            setMessage("WebXR requires a secure context (https).");
            return;
        }

        // FIX: The package exposes an underlying webxr implementation check natively or via WebXR
        // Since WebXR is exported, check if it contains the check or fallback to native browser checking
        const checkSupport = navigator.xr?.isSessionSupported 
            ? navigator.xr.isSessionSupported(mode)
            : Promise.resolve(false);

        checkSupport.then(supported => {
            if (!supported) {
                setMessage(`WebXR '${mode}' is not supported on this device.`);
            } else {
                setIsSessionSupported(true);
            }
        });
    }, [mode]);

    return (
        <Button
            variant="overlay-outline"
            className={
                cn("rounded-full before:opacity-100 before:backdrop-blur-xl", !isSessionSupported && "opacity-50 cursor-not-allowed")
            }
            onClick={() => setXRMode(mode)}
            disabled={!isSessionSupported}
            title={message}
        >
            {text} {xrModeTitle}
        </Button>
    );
}
