import htmlContent from "./index.html" with { type: "text" };
import cssContent from "./style.css" with { type: "text" };
import jsContent from "./dist/app.txt" with { type: "text" };

export const WEB_ASSETS = {
  html: (htmlContent as unknown) as string,
  css: (cssContent as unknown) as string,
  js: (jsContent as unknown) as string,
} as const;
