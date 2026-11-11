import { useEffect } from "react";

/** The tab's title while the component is mounted; the one it had before once it is gone. */
export function useDocumentTitle(title: string) {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = title;
    return () => {
      document.title = previousTitle;
    };
  }, [title]);
}
