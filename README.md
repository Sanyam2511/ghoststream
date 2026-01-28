# GhostStream

> **Secure, Serverless, Peer-to-Peer File Transfer.** > *No Cloud. No Limits. Just Physics.*

<img width="2493" height="1269" alt="image" src="https://github.com/user-attachments/assets/10856a41-6a98-40ba-9751-0e237ea66c68" />


---

## Live Demo

- **Frontend:** [https://ghoststream-vbbi.vercel.app](ghoststream-vbbi.vercel.app)
- **Backend:** [https://ghoststream-server.onrender.com](https://ghoststream-server.onrender.com)

---

## Overview

**GhostStream** is a real-time file sharing application that establishes a direct **WebRTC** connection between two devices. Unlike traditional cloud services (Google Drive, WeTransfer), files are **never uploaded to a server**. They stream directly from the sender's RAM to the receiver's RAM via an encrypted P2P tunnel.

This architecture ensures **maximum privacy**, **zero bandwidth costs** for the host, and transfer speeds limited only by the peers' network connection.

---

## Key Features

### Security First
- **End-to-End Encryption:** Uses WebRTC (DTLS/SRTP) for data transport.
- **SHA-256 Integrity Check:** Every file is hashed before sending and verified upon receipt to ensure zero corruption.
- **Self-Destructing Rooms:** Sessions automatically wipe themselves **30 seconds** after a transfer completes to protect user privacy.

### Performance Engineering
- **Smart Congestion Control:**
  - **Speed Mode:** 256KB chunks for high-bandwidth LAN/Fiber connections.
  - **Stable Mode:** 16KB chunks with aggressive error checking for poor mobile networks.
- **Backpressure Handling:** Respects the receiver's buffer rate to prevent memory crashes on large files.

### Data & UX
- **Offline Analytics:** Uses **IndexedDB** to track lifetime transfer stats directly on the user's device (privacy-preserving).
- **Real-Time Chat:** Integrated signaling channel for messaging during transfers.
- **Cross-Device:** Works flawlessly between Mobile and Desktop.

---

## Tech Stack

### Frontend (Client)
- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS + Lucide Icons
- **State:** React Hooks (Custom Micro-Hooks)
- **P2P Logic:** `simple-peer` (WebRTC wrapper)

### Backend (Signaling)
- **Runtime:** Node.js
- **Communication:** Socket.io (WebSockets)
- **Role:** Signaling Server (SDP Exchange / Handshake only)

---

## Architecture



1.  **Signaling:** Peer A and Peer B connect to the Socket.io server to exchange "Handshake" data (SDP Signals & ICE Candidates).
2.  **Tunneling:** Once the handshake is complete, a direct P2P connection is established.
3.  **Streaming:** The server disconnects from the data flow. The file is sliced into binary chunks and sent directly over the P2P channel.

---

## Running Locally

### Prerequisites
- Node.js (v18+)
- npm

### 1. Clone the Repository
```bash
git clone [https://github.com/yourusername/ghoststream.git](https://github.com/yourusername/ghoststream.git)
cd ghoststream
```

### 2. Setup Backend (Signaling Server)
```bash
cd server
npm install
# Start the server on port 3001
npm start
```

### 3. Setup Frontend (Client)
Open a new terminal window:
```bash
cd client
npm install
```

# Create .env.local file
echo "NEXT_PUBLIC_SOCKET_URL=http://localhost:3001" > .env.local

# Start the app
npm run dev

## Code Structure

```text
/src
  ├── /hooks
  │   ├── useGhostStream.ts       # Main Controller (Room logic, Timers)
  │   ├── useFileTransfer.ts      # Transfer Orchestrator
  │   └── /transfer
  │       ├── useSender.ts        # Reading, Hashing, Chunking logic
  │       ├── useReceiver.ts      # Reassembly & Integrity Verification
  │       └── useMessaging.ts     # Chat & Ping/Pong Latency
  ├── /components                 # UI Components (Modals, Panels, Terminal)
  └── /utils
      ├── analyticsDB.ts          # IndexedDB Wrapper
      └── modes.ts                # Configuration for Speed/Stable modes



