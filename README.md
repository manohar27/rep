# rep

A fast, offline-first workout logger PWA.

- Start an empty session or start from a template
- Add exercises from a library of ~290 gym exercises (search + muscle filters), or create custom ones
- Log weight × reps per set; previous numbers are shown and auto-filled
- Rest timer after each completed set
- Save any session as a template
- Spring animations, haptics and swipe-to-delete sets

Data is stored locally on your device (localStorage).

## Develop

```bash
npm install
npm run dev
npm run build
```

Stack: Vite, React, TypeScript, framer-motion, zustand, vite-plugin-pwa. Deployed on Vercel.
