# TalaRide MVP: Project Goals, Domain Objects & Mobile App Integration

> **Core Philosophy**: *"Identify the ride and make payment effortless."*  
> TalaRide does not attempt to replace cash, nor does it force every passenger to install an app. Instead, it bridges riders, drivers, vehicles, fares, payment gateways, and safety ride records.

---

## 1. Project Objectives & Success Goals

The first version (MVP) of TalaRide is designed to prove four fundamental hypotheses:

```mermaid
flowchart TD
    G1["1. Driver Willingness<br/>Tricycle drivers willingly adopt digital payments alongside cash."]
    G2["2. Frictionless QR Ph Commuter Payments<br/>Commuters pay in <5s using GCash, Maya, GoTyme, or banks."]
    G3["3. Commuter App Value Proposition<br/>Users download app for Safety Records, Lost Item Recovery & Rewards."]
    G4["4. Reliable Transit Attribution<br/>Reliably identify Driver DR-xxx + Vehicle TR-xxx + Shift + Location."]

    G1 --> TalaRideMVP["TalaRide MVP Validation"]
    G2 --> TalaRideMVP
    G3 --> TalaRideMVP
    G4 --> TalaRideMVP
```

### Primary Validation Goals
1. **Driver Digital Adoption**: Drivers easily generate QR codes and see instant, guaranteed visual/audio confirmation without peering at passenger phone screens.
2. **Interoperable Guest Experience**: Commuters without TalaRide scan with standard Philippine QR Ph e-wallets (GCash, Maya, ShopeePay, GoTyme, BDO, BPI) with zero friction.
3. **Safety & Lost Item Utility**: Commuters who pay cash can still scan permanent tricycle stickers to create a safety check-in record and retrieve forgotten belongings.
4. **Driver Net Payout Transparency**: Clear delineation between Gross Fare, Gateway Processing Fees (1.75%), and Net Driver Payout.

---

## 2. Core Domain Goal Objects

These data objects model the micro-transit ecosystem and are exposed through the backend API to native mobile apps and the web portal.

```mermaid
erDiagram
    USER ||--o{ DRIVER : "identifies as"
    USER ||--o{ RIDE : "commutes via"
    DRIVER ||--o{ DRIVER_SHIFT : "initiates"
    VEHICLE ||--o{ DRIVER_SHIFT : "assigned to"
    DRIVER_SHIFT ||--o{ RIDE : "operates"
    RIDE ||--o| PAYMENT : "settled by"
    RIDE ||--o{ LOST_ITEM_REPORT : "has claims"
    RIDE ||--o| REWARDS_TRANSACTION : "awards"
    PAYMENT ||--o{ PAYMENT_ISSUE : "subject to dispute"

    USER {
        string user_id PK
        string mobile_number
        string name
        enum account_type "driver | commuter | admin"
        enum status "active | suspended"
    }

    DRIVER {
        string driver_id PK "e.g. DR-000481"
        string user_id FK
        string license_number
        string toda_operator "e.g. Tagum Poblacion TODA"
        enum verification_status "verified | pending | suspended"
        enum shift_status "active | ended"
    }

    VEHICLE {
        string vehicle_id PK "e.g. TR-01842"
        string plate_body_number "TAG-842"
        string toda "Tagum Poblacion TODA"
        string qr_code_payload "Permanent Sticker QR"
        enum status "active | maintenance | inactive"
    }

    DRIVER_SHIFT {
        string shift_id PK
        string driver_id FK
        string vehicle_id FK
        datetime start_time
        datetime end_time
        int digital_rides_count
        float digital_gross_total
        float provider_platform_fees
        float digital_net_total
        int cash_rides_count
    }

    RIDE {
        string ride_id PK "e.g. RIDE-2026-8941"
        string driver_id FK
        string vehicle_id FK
        string passenger_id FK "optional for guest"
        datetime timestamp
        string approximate_location "Tagum City"
        enum payment_method "digital | cash"
        float fare_amount
        boolean is_checkin_only
    }

    PAYMENT {
        string payment_id PK "e.g. PAY-99214"
        string ride_id FK
        float amount
        enum provider "gcash | maya | gotyme | qrph_bank"
        string provider_reference
        enum payment_status "pending | paid | failed | refunded"
        float provider_fee
        float net_amount
        string qr_payload "QR Ph interoperable format"
        datetime expires_at
    }

    LOST_ITEM_REPORT {
        string report_id PK "e.g. LIR-0042"
        string ride_id FK
        enum item_category "phone | wallet | bag | documents | keys | other"
        string description
        enum status "submitted | driver_notified | found | unresolved | closed"
        enum driver_response "found | not_found | contact_support"
    }

    REWARDS_TRANSACTION {
        string reward_id PK
        string user_id FK
        string ride_id FK
        int points "1 TalaPoint per digital ride"
        enum status "earned | redeemed | revoked"
    }
```

---

## 3. How the Backend Connects to the Mobile Apps

The TalaRide architecture supports both **Responsive Web/PWA** and **Native Mobile Apps (React Native, Flutter, iOS, Android, or Capacitor)**.

```mermaid
sequenceDiagram
    autonumber
    actor Driver as Driver Mobile App
    actor Passenger as Commuter Mobile / Guest E-Wallet
    participant API as TalaRide Backend API
    participant SSE as Real-Time Event Stream (/api/events)
    participant Gateway as QR Ph Payment Provider (GCash/Maya)

    Note over Driver,API: 1. Driver Shift Setup
    Driver->>API: POST /api/drivers/shifts/start {driverId: "DR-000481", vehicleId: "TR-01842"}
    API-->>Driver: Shift Started (Unit TR-01842 Assigned)
    Driver->>SSE: Open Persistent Connection (/api/events?driverId=DR-000481)

    Note over Driver,Passenger: 2. Fare Selection & QR Generation
    Driver->>API: POST /api/payments/create-qr {fareAmount: 30, vehicleId: "TR-01842"}
    API-->>Driver: Returns Dynamic QR Ph Payload & Expiry (10m)
    Driver->>Driver: Renders High-Contrast QR on Mobile Screen

    Note over Passenger,Gateway: 3. Commuter Scans & Authorizes
    alt Guest Commuter (No TalaRide Installed)
        Passenger->>Passenger: Opens GCash / Maya / GoTyme camera
        Passenger->>Gateway: Scans QR Ph & Authorizes ₱30.00
        Gateway->>API: Webhook / Server Confirmation (Ref: GCASH-8842109)
    else TalaRide App Commuter
        Passenger->>API: Scans via TalaRide Camera -> POST /api/payments/confirm-payment
        API->>Gateway: Settle QR Ph transaction
        Gateway-->>API: Payment Captured
    end

    Note over API,Driver: 4. Real-time Push to Driver Mobile Device
    API->>API: Update Driver Shift (+₱30 Gross, -₱0.53 Fee, +₱29.47 Net)
    API->>API: Award +1 TalaPoint to Passenger (if registered)
    API->>SSE: Emit 'payment_confirmed' {paymentId, amount: 30, net: 29.47}
    SSE-->>Driver: PUSH 'payment_confirmed'
    Driver->>Driver: Trigger Web Audio Chime (880Hz -> 1320Hz)
    Driver->>Driver: Trigger Device Haptic Vibration [180ms, 80ms, 180ms]
    Driver->>Driver: Full-Screen Emerald State ("✓ PAID ₱30")
```

---

## 4. Mobile Hardware & Native OS Integrations

| Feature | Mobile Native API / Hardware | Purpose in TalaRide |
| :--- | :--- | :--- |
| **QR Code Scanner** | `react-native-camera` / `@capacitor/barcode-scanner` / Web `MediaDevices.getUserMedia()` | Scans dynamic payment QRs and permanent vehicle safety stickers. |
| **High-Contrast Display** | Dynamic brightness / Ambient Light Sensor API | Ensures the Driver Fare screen and QR code remain legible in tropical midday sunlight. |
| **Instant Audio Feedback** | Web Audio API / `react-native-sound` / AVPlayer | Plays dual-harmonic chime so drivers do not have to look down while driving. |
| **Tactile Vibration** | `navigator.vibrate` / `Vibration.vibrate()` | Triple-pulse haptic pattern confirming payment received in noisy traffic. |
| **Voluntary Location** | `navigator.geolocation` / CoreLocation / Google Play Services Location | Captures approximate city/street pickup coordinates solely upon voluntary permission. |
| **Offline Cache & Sync** | IndexedDB / SQLite / Room DB | Stashes voluntary cash ride check-ins when cell service drops, syncing when connectivity resumes. |

---

## 5. API Endpoint Contracts for Mobile Clients

### Authentication & Driver Terminal
- `POST /api/auth/otp-request`: Request 4-digit SMS OTP for driver or passenger.
- `POST /api/auth/otp-verify`: Verify OTP and establish driver session.
- `GET /api/drivers/:id`: Retrieve driver profile, TODA operator, active vehicle, and shift.
- `POST /api/drivers/shifts/start`: Bind driver to physical tricycle unit and start meter.
- `POST /api/drivers/shifts/end`: Close shift and generate summary payout report.
- `POST /api/drivers/cash-ride`: Record an offline cash trip into shift statistics.
- `GET /api/drivers/:id/summary`: Real-time daily dashboard: gross fare, provider fees, and net earnings.

### Dynamic QR Ph & Payment Rails
- `POST /api/payments/create-qr`: Generate dynamic QR Ph payload with 10-minute validity.
- `GET /api/payments/:id`: Poll or inspect payment status.
- `POST /api/payments/confirm-payment`: Process payment confirmation and trigger driver SSE alert.
- `POST /api/payments/issues`: Report double charges or dispute fares.

### Commuter Safety & History
- `POST /api/rides/safety-checkin`: Commuter scans permanent vehicle sticker to save safety record.
- `GET /api/rides`: Fetch personalized ride history (digital & cash).
- `GET /api/rides/:id`: Fetch ride receipt, assigned driver details, and pickup location.
- `POST /api/lost-items`: Submit lost item claims mediated by TalaRide (phone numbers kept private).
- `GET /api/rewards/:userId`: Retrieve TalaPoints balance, active promotional vouchers, and milestones.

### Real-Time Event Stream
- `GET /api/events?driverId=DR-xxxxx`: Server-Sent Events stream for instant driver chime & push notifications.
