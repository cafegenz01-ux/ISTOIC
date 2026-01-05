
import { DataConnection } from 'peerjs';
import { v4 as uuidv4 } from 'uuid';
import { debugService } from './debugService';

// --- TYPES ---
export type Participant = {
    id: string; // Peer ID
    name: string;
    role: 'HOST' | 'CLIENT';
    status: 'ONLINE' | 'RECONNECTING' | 'OFFLINE';
    lastPing: number;
    conn: DataConnection;
};

export type PacketType = 
    | 'HANDSHAKE' 
    | 'SYNC_REQ' 
    | 'SYNC_RESP' 
    | 'MESSAGE' 
    | 'NOTE_UPDATE' 
    | 'HEARTBEAT';

export interface NetworkPacket {
    id: string;
    type: PacketType;
    senderId: string;
    payload: any;
    timestamp: number;
}

// --- ROOM MANAGER CORE ---
export class RoomManager {
    private myId: string;
    private myName: string;
    private role: 'HOST' | 'CLIENT' = 'CLIENT';
    
    // The "Source of Truth" State
    private participants: Map<string, Participant> = new Map();
    private messageHistory: any[] = [];
    
    // Callbacks for UI updates
    private onStateUpdate: (state: any) => void;
    private onMessage: (msg: any) => void;

    constructor(myId: string, myName: string, onUpdate: any, onMsg: any) {
        this.myId = myId;
        this.myName = myName;
        this.onStateUpdate = onUpdate;
        this.onMessage = onMsg;
    }

    // --- 1. HOST LOGIC ---
    public createRoom() {
        this.role = 'HOST';
        this.participants.clear();
        debugService.log('INFO', 'ROOM', 'INIT', 'Room created. Waiting for peers...');
        
        // Start Heartbeat Loop to maintain order
        setInterval(() => this.checkHeartbeats(), 5000);
    }

    // Called when someone connects to us
    public handleIncomingConnection(conn: DataConnection) {
        debugService.log('INFO', 'ROOM', 'JOIN_REQ', `Peer ${conn.peer} attempting to join.`);

        conn.on('open', () => {
            // Register preliminary participant
            this.participants.set(conn.peer, {
                id: conn.peer,
                name: 'Unknown', // Will be updated on Handshake
                role: 'CLIENT',
                status: 'ONLINE',
                lastPing: Date.now(),
                conn: conn
            });

            conn.on('data', (data: any) => this.processPacket(data, conn.peer));
            conn.on('close', () => this.handleDisconnect(conn.peer));
            conn.on('error', () => this.handleDisconnect(conn.peer));
            
            // Send Welcome Handshake
            this.sendTo(conn.peer, 'HANDSHAKE', { hostName: this.myName });
        });
    }

    // --- 2. CLIENT LOGIC ---
    public joinRoom(hostConn: DataConnection) {
        this.role = 'CLIENT';
        
        hostConn.on('open', () => {
            debugService.log('INFO', 'ROOM', 'CONNECTED', 'Connected to Host.');
            
            // Register Host
            this.participants.set(hostConn.peer, {
                id: hostConn.peer,
                name: 'HOST',
                role: 'HOST',
                status: 'ONLINE',
                lastPing: Date.now(),
                conn: hostConn
            });

            hostConn.on('data', (data: any) => this.processPacket(data, hostConn.peer));
            
            // Send Identity
            this.sendTo(hostConn.peer, 'HANDSHAKE', { name: this.myName });
            // Request Full Data Sync
            this.sendTo(hostConn.peer, 'SYNC_REQ', {});
        });
    }

    // --- 3. THE "SMART" ROUTER (Packet Logic) ---
    private processPacket(packet: NetworkPacket, senderId: string) {
        // Update Heartbeat
        const participant = this.participants.get(senderId);
        if (participant) {
            participant.lastPing = Date.now();
            participant.status = 'ONLINE';
            if (packet.type === 'HANDSHAKE' && packet.payload.name) {
                participant.name = packet.payload.name;
                this.notifyUI(); // Update list name
            }
        }

        switch (packet.type) {
            case 'MESSAGE':
                this.handleMessagePacket(packet);
                break;
            case 'SYNC_REQ':
                if (this.role === 'HOST') {
                    // Host sends entire history to new joiner
                    this.sendTo(senderId, 'SYNC_RESP', { 
                        messages: this.messageHistory,
                        users: Array.from(this.participants.values()).map(p => ({ id: p.id, name: p.name }))
                    });
                }
                break;
            case 'SYNC_RESP':
                // Client updates their local state from host
                this.messageHistory = packet.payload.messages;
                this.onMessage(this.messageHistory); 
                break;
        }
    }

    private handleMessagePacket(packet: NetworkPacket) {
        // 1. Save to local history
        this.messageHistory.push(packet.payload);
        this.onMessage(packet.payload); // Update UI

        // 2. IF HOST: Broadcast to everyone else (The Star Topology Logic)
        if (this.role === 'HOST') {
            this.broadcast(packet, packet.senderId); // Don't send back to sender
        }
    }

    // --- 4. DATA TRANSMISSION ---
    
    public broadcastMessage(content: string, type: 'TEXT' | 'IMAGE' | 'AUDIO') {
        const msgPayload = {
            id: uuidv4(),
            senderId: this.myId,
            senderName: this.myName,
            content,
            type,
            timestamp: Date.now()
        };

        // Add to own UI
        this.handleMessagePacket({
            id: uuidv4(),
            type: 'MESSAGE',
            senderId: this.myId,
            payload: msgPayload,
            timestamp: Date.now()
        });

        // Send out
        if (this.role === 'HOST') {
            this.broadcast({ id: uuidv4(), type: 'MESSAGE', senderId: this.myId, payload: msgPayload, timestamp: Date.now() });
        } else {
            // Client sends to Host only
            const host = Array.from(this.participants.values()).find(p => p.role === 'HOST');
            if (host) {
                this.sendTo(host.id, 'MESSAGE', msgPayload);
            }
        }
    }

    private sendTo(targetId: string, type: PacketType, payload: any) {
        const target = this.participants.get(targetId);
        if (target && target.conn.open) {
            const packet: NetworkPacket = {
                id: uuidv4(),
                type,
                senderId: this.myId,
                payload,
                timestamp: Date.now()
            };
            target.conn.send(packet);
        }
    }

    private broadcast(packet: NetworkPacket, excludeId?: string) {
        this.participants.forEach(p => {
            if (p.id !== excludeId && p.status === 'ONLINE') {
                p.conn.send(packet);
            }
        });
    }

    // --- 5. MAINTENANCE & CLEANUP ---
    private checkHeartbeats() {
        const now = Date.now();
        this.participants.forEach(p => {
            if (now - p.lastPing > 15000) { // 15s timeout
                p.status = 'OFFLINE';
                this.notifyUI();
            }
        });
    }

    private handleDisconnect(peerId: string) {
        const p = this.participants.get(peerId);
        if (p) {
            p.status = 'OFFLINE';
            this.notifyUI();
        }
    }

    private notifyUI() {
        // Send simplified participant list to UI
        const users = Array.from(this.participants.values()).map(p => ({
            id: p.id,
            name: p.name,
            status: p.status,
            isHost: p.role === 'HOST'
        }));
        users.unshift({ id: this.myId, name: `${this.myName} (YOU)`, status: 'ONLINE', isHost: this.role === 'HOST' });
        
        this.onStateUpdate(users);
    }
}
