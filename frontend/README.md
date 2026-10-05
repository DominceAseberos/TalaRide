# TalaRide Frontend Web Application

Modern, high-performance web client for the TalaRide micro-transit digital payments and safety ecosystem.

## Deployable Separately
This frontend is completely decoupled from the backend and can be deployed directly to:
- **Vercel** (`npm run build`, output directory: `dist`)
- **Cloudflare Pages** (`npm run build`, output directory: `dist`)
- **Netlify** (`npm run build`, publish directory: `dist`)
- **AWS S3 / CloudFront / Firebase Hosting**

Set `VITE_API_URL` environment variable if your backend is hosted at a custom domain (e.g. `https://api.talaride.ph`). If left empty, it defaults to `/api` proxy.

## Key Modules Included
1. **Driver Terminal**
   - Sunlight-legible high-contrast UI with 60px+ touch targets
   - Vehicle assignment & Shift check-in (Driver DR-000481 ↔ Vehicle TR-01842)
   - Standard fare buttons (₱15, ₱20, ₱25, ₱30, ₱40) & Custom fare agreement (₱120)
   - Dynamic QR Ph generation with 10-minute expiry countdown
   - Audio chime synthesizer & haptic vibration on payment confirmation
   - Cash ride logging & daily transaction breakdown (Fare vs Net after fees)
   - Mediated lost-item notifications
2. **Commuter App**
   - Quick "SCAN RIDE" QR scanner
   - Review tricycle & fare details before payment
   - QR Ph payment flow supporting GCash, Maya, and GoTyme
   - Ride history with details & mediated lost-item report submission
   - TalaRide Rewards progress bar (1 TalaPoint per ride, 10 rides unlock promo reward)
   - Cash Safety Check-In (scan permanent vehicle sticker to save ride without payment)
   - Privacy permissions & legal disclaimers
3. **Guest QR Ph Checkout**
   - Zero-installation payment experience for GCash/Maya/bank scanners
   - Displays merchant name, vehicle, amount, and server-verified receipt
4. **Admin Operations Portal**
   - Operations dashboard for TODA associations and LGU transit officers
   - Full CRUD for Drivers, Vehicles, printable stickers, payment disputes, and fare configurations
5. **Interactive Dual-Screen Simulator**
   - Side-by-side Driver and Commuter phones with real-time SSE & audio feedback

## Local Development

```bash
cd frontend
npm install
npm run dev
```

Build for production:
```bash
npm run build
```
