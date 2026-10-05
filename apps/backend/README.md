# TalaRide Backend API

Microservice API & Real-time Event Hub for the TalaRide Tricycle Digital Payment & Ride-Recording System.

## Features
- **Authentication**: Mobile number + OTP, driver PIN/biometrics verification.
- **Driver Operations**: Start/End shifts, vehicle assignment (Driver DR-000481 ↔ Vehicle TR-01842), cash ride logging, daily net totals after digital payment gateway fees.
- **QR Ph Payment Gateway**: Dynamic QR Ph code generation with 10-minute expiry, standard fares (₱15, ₱20, ₱25, ₱30, ₱40) and confirmed custom fares (e.g. ₱120).
- **Simulated Instant Payment & Settlement**: Provider confirmation via webhook/API with fee deduction (1.75%) and net driver payout calculation.
- **Real-Time SSE Event Stream**: Instant push notifications to driver app for chime/vibration when passenger payment completes (`/api/events`).
- **Commuter Safety Check-In**: Scan vehicle permanent QR sticker to record ride and driver ID even on cash payment without requiring digital payment.
- **Mediated Lost Item Assistance**: Privacy-preserving lost item ticketing between rider, driver, and TODA admin.
- **TalaRide Rewards Engine**: 1 TalaPoint per digital ride, 10 rides unlock promotional discounts/vouchers, with anti-fraud controls.
- **Admin Management**: Full CRUD for Drivers, Vehicles, Assignments, Transactions, Disputes, and Fare Configurations.

## Running Locally

```bash
# Install dependencies
npm install

# Start in development mode (with hot reloading)
npm run dev

# Or compile and run in production
npm run build
npm start
```

Default Port: `http://localhost:4000`  
Health check: `http://localhost:4000/api/health`

## Deploying Separately
This backend is a standalone Node.js service. It can be deployed directly to Render, Railway, Fly.io, AWS, Heroku, or any Docker container. Set the environment variable `PORT` to the assigned hosting port.
