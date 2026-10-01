# Wardrobe AI

A personal digital wardrobe and AI styling web application that helps users organize their clothes, generate outfits, and visualize selected wardrobe items on an AI-generated adult fashion model.

## Features

**V1**: digital wardrobe, clothing uploads (compressed locally), categories, responsive interface.
**V2**: search, filters, sorting, scored outfit generator, outfit history, wear tracking, saved outfits, wardrobe statistics, light/dark/system theme, demo wardrobe.
**V3**: optional AI clothing analysis (always editable), style profile, hybrid local + AI stylist, stylist chat, Style This, forgotten-clothes outfits, feedback and ratings, weather hook, local fallback when AI is unavailable.
**V4**: Virtual Try-On. From an outfit result, press *See It On a Model*, choose a model presentation, build, pose, background and lighting, then *Generate Look*. The wardrobe photos are sent as reference images to your backend. Looks are saved in IndexedDB under *My Looks* with favourite, open, regenerate, change model/background, and delete.

## Project structure

```
wardrobe-ai/
├── index.html   landing page
├── app.html     the whole application (views switch with JavaScript)
├── style.css    all styling
├── app.js       all logic
└── README.md
```

No build step, no npm, no framework. Deploy by publishing the folder with GitHub Pages. All paths are relative.

## Data and privacy

Wardrobe, outfits and looks live in this browser (IndexedDB / localStorage). With every AI setting off (the default) nothing leaves the device. Optional features send data only to the services you configure: AI styling sends item details, analysis sends the uploaded photo, weather sends rounded location, and Virtual Try-On sends the selected garment images after the user consents. The in-app Settings page explains this to users.

## Connecting AI and Virtual Try-On (needs your own backend)

GitHub Pages is static, so **never put a provider API key in these files**. Run a small serverless/backend proxy that holds the key, then set the endpoints at the top of `app.js` (`AI_CONFIG`, `TRY_ON_CONFIG`) and set `enabled: true`.

- AI proxy contract: see the comment above `AI_CONFIG` (`/analyze`, `/stylist`, `/chat`, weather and background endpoints).
- Virtual Try-On: `POST TRY_ON_CONFIG.endpoint` with `{outfitId, clothingItems:[{id,name,category,image,metadata}], modelSettings:{presentation,build,pose,background,lighting}, generationPrompt, timestamp}`. Respond with `{ "image": "data:image/...;base64,..." }` (or an `https://` URL). The backend adapts this to your provider. Garment fidelity depends entirely on the provider; the app does not guarantee it.

If a service is not configured or fails, the app shows a friendly message and keeps working with the local engine.

## Safety

Models are ordinary adult fashion-model visualizations for a general audience. Model presentation and build describe the generated model only, never the user.
