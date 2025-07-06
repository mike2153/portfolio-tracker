# Page snapshot

```yaml
- alert
- button "Open Next.js Dev Tools":
  - img
- button "Open issues overlay": 1 Issue
- navigation:
  - button "previous" [disabled]:
    - img "previous"
  - text: 1/1
  - button "next" [disabled]:
    - img "next"
- img
- link "Next.js 15.3.4 (stale) Webpack":
  - /url: https://nextjs.org/docs/messages/version-staleness
  - img
  - text: Next.js 15.3.4 (stale) Webpack
- img
- dialog "Build Error":
  - text: Build Error
  - button "Copy Stack Trace":
    - img
  - button "No related documentation found" [disabled]:
    - img
  - link "Learn more about enabling Node.js inspector for server code with Chrome DevTools":
    - /url: https://nextjs.org/docs/app/building-your-application/configuring/debugging#server-side-code
    - img
  - paragraph: "Error: x Unexpected eof"
  - img
  - text: ./src/components/StockSearchInput.tsx
  - button "Open in editor":
    - img
  - text: "Error: x Unexpected eof ,-[/app/src/components/StockSearchInput.tsx:245:1] 242 | )} 243 | </div> 244 | ); 245 | } `---- Caused by: Syntax Error"
- contentinfo:
  - paragraph: This error occurred during the build process and can only be dismissed by fixing the error.
```