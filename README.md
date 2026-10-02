# Wardrobe AI

A personal digital wardrobe and AI styling web app: organize your clothes, generate outfits, and (optionally) see a selected garment on an AI-generated adult model.

## Feature history
- **V1** wardrobe, uploads (compressed locally), categories, responsive UI.
- **V2** search, filters, sorting, scored outfit generator, history, wear tracking, saved outfits, statistics, dark mode, demo wardrobe.
- **V3** optional AI clothing analysis (always editable), style profile, hybrid local + AI stylist, chat, Style This, feedback and ratings, weather hook, local fallback.
- **V4** virtual try-on UI, My Looks gallery (IndexedDB).
- **V4.2** free Hugging Face try-on provider (replaces the paid FASHN provider; no FASHN key needed).

## V4.2 architecture

```
Wardrobe UI -> generateVirtualTryOn() -> tryOnProvider -> /api/tryon (Cloudflare Pages Function)
            -> Hugging Face Gradio Space (IDM-VTON or compatible) -> image -> My Looks (IndexedDB)
```

The browser only calls `/api/tryon`. The Function reads the Space's own API schema (`/gradio_api/info`, falling back to `/info`), uploads the model photo and the selected garment, submits the job, and returns normalized JSON (`processing`, `queued`, `completed`, or an error code). Hugging Face tokens stay server-side. Another provider can be added by implementing the same three methods (`generate`, `getStatus`, `cancel`) in the browser and a matching provider object in `functions/api/tryon.js`.

**Status:** the gateway has been tested against a *mock* Space only. A real generation against a live Space has not yet been verified. Do that first (see Testing checklist).

## What the model can and cannot do
- The IDM-VTON Space masks the **upper body**, so only **tops and jackets** can be tried on. Trousers, shoes and accessories are not supported and the UI says so.
- **One garment per generation.** Multi-garment chaining exists behind `TRY_ON_CONFIG.experimentalMulti` (default **off**). Chaining generated images can distort clothing, shift colours, drift identity and alter earlier garments. Keep it off unless real tests look good.
- Pose, body presentation and background come from the **model photo**. There are no pose/lighting/background controls because the provider has none.

## Hugging Face setup and configuration
1. Choose a public virtual try-on Space (for example `yisol/IDM-VTON`). Check that it is running; free Spaces sleep.
2. In Cloudflare Pages, Settings, Variables and Secrets, add:
   - `HF_SPACE_ID` (e.g. `yisol/IDM-VTON`) **or** `HF_SPACE_URL` (e.g. `https://yisol-idm-vton.hf.space`)
   - `HF_TOKEN` (**Secret**, optional but recommended: requests then use your own free ZeroGPU quota instead of a shared one)
   - `HF_ENDPOINT` (optional; override the auto-detected endpoint name, e.g. `/tryon`)
   - `MODEL_A_IMAGE`, `MODEL_B_IMAGE`, `MODEL_C_IMAGE` (optional URLs)
3. Model photos: add adult, full-body, front-facing, well-lit photos with a simple pose and plain background that you have the rights to use as `assets/models/model-a.jpg`, `model-b.jpg`, `model-c.jpg` (or set the variables). Wardrobe AI ships none. Never put a token in frontend files.

## Local development
Copy `.dev.vars.example` to `.dev.vars` (git-ignored), fill it in, then run `npx wrangler pages dev .`.

## Deployment
Push to GitHub and connect the repo to Cloudflare Pages (no build command, output directory = repo root). Keep `functions/` at the root. Add the variables above and redeploy. On plain GitHub Pages the app works but try-on shows "temporarily unavailable".

## Free GPU limitations
Free Hugging Face ZeroGPU access has a limited daily quota and can queue, sleep or refuse requests. This is a free workflow for development and testing, not guaranteed production capacity. The app never promises unlimited generations and shows a friendly message when the GPU is busy or the quota is used up. Generation stops waiting after 3 minutes.

## Privacy
Generating a look sends only the selected garment photo and the chosen model photo to the connected Hugging Face Space, after you consent. Do not assume images stay on your device. Everything else stays in your browser. Save Look copies the result into IndexedDB because provider URLs are temporary.

## AI MODEL LICENSE
This project may use IDM-VTON and/or another compatible Hugging Face Space. **IDM-VTON is licensed under CC BY-NC-SA 4.0** (non-commercial). Review the applicable model and Space licenses before any commercial use. This project does not claim the model is commercially unrestricted.

## Troubleshooting
- *Not configured*: set `HF_SPACE_ID`/`HF_SPACE_URL` and add the model photos.
- *Space does not expose a compatible API endpoint*: the Space's schema has no usable image-in/image-out endpoint; set `HF_ENDPOINT` or choose another Space.
- *Temporarily unavailable*: Space sleeping, paused or down. Open it once in a browser, retry later.
- *Free GPU busy / quota*: wait, or set `HF_TOKEN`.
- *Took too long*: queue timeout; retry.
- *Invalid image*: use a JPEG/PNG/WEBP photo of one garment.
- *Poor result*: single garment, flat and well lit on a plain background; try a different model photo.

## Testing checklist
1. `/api/tryon` responds (not configured vs configured). 2. Model A image loads. 3. White Shirt accepted. 4. **Real generation, then look at the image.** 5. Corrupt image gives a friendly error. 6. Stopped Space gives "temporarily unavailable". 7. Busy Space shows the waiting state. 8. Timeout stops polling. 9. Save Look appears in My Looks. 10. Generate Again makes a new request. 11. Search the repo for `hf_` and tokens. 12. Run the whole flow on an Android phone.

## Future provider migration
Add a provider object next to `huggingface` in `functions/api/tryon.js` and a matching `tryOnProvider` in `app.js`; the UI does not change.
