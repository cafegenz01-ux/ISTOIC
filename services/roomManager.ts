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
    | 'HEARTBEAT'
    | 'KICK'; // Fitur usir member

export interface NetworkPacket {
    id: string;
    type: PacketType;
    senderId: string;
    senderName?: string; // Menambahkan nama pengirim di paket
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
        
        // Add self to participant list for UI consistency
        this.notifyUI();
        
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
                name: 'Unknown', 
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
            
            // Sync Current Participants to everyone (Update roster)
            this.broadcastUserList();
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

    public leaveRoom() {
        this.participants.forEach(p => p.conn.close());
        this.participants.clear();
        this.messageHistory = [];
        this.notifyUI();
    }

    // --- 3. THE "SMART" ROUTER (Packet Logic) ---
    private processPacket(packet: NetworkPacket, senderId: string) {
        // Update Heartbeat
        const participant = this.participants.get(senderId);
        if (participant) {
            participant.lastPing = Date.now();
            participant.status = 'ONLINE';
            
            // Update Name on Handshake
            if (packet.type === 'HANDSHAKE' && packet.payload.name) {
                participant.name = packet.payload.name;
                // If I am host, broadcast this new name to everyone
                if (this.role === 'HOST') this.broadcastUserList();
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
                        users: this.getPublicList()
                    });
                }
                break;
            case 'SYNC_RESP':
                // Client updates their local state from host
                if (packet.payload.messages) {
                    this.messageHistory = packet.payload.messages;
                    this.onMessage(this.messageHistory); // Refresh UI Messages
                }
                // Sync User List
                if (packet.payload.users) {
                     // We don't overwrite the connection map, just the UI list visualization
                     // In a full implementation, we'd sync this better, but for now we trust the host.
                     this.onStateUpdate(packet.payload.users);
                }
                break;
            case 'NOTE_UPDATE':
                // Feature for collaborative notes (future)
                break;
        }
    }

    private handleMessagePacket(packet: NetworkPacket) {
        // 1. Check if we already have this message (Deduplication)
        if (this.messageHistory.some(m => m.id === packet.id)) return;

        // 2. Save to local history
        this.messageHistory.push(packet.payload);
        this.onMessage(packet.payload); // Update UI (Add single message)

        // 3. IF HOST: RELAY (Forward) to everyone else
        // This is the Key to Multi-User Chat!
        if (this.role === 'HOST') {
            this.broadcast(packet, packet.senderId); 
        }
    }

    // --- 4. DATA TRANSMISSION ---
    
    public broadcastMessage(content: string, type: 'TEXT' | 'IMAGE' | 'AUDIO' | 'FILE') {
        const msgPayload = {
            id: uuidv4(),
            senderId: this.myId,
            senderName: this.myName,
            content,
            type,
            timestamp: Date.now(),
            status: 'SENT'
        };

        // Create packet
        const packet: NetworkPacket = {
            id: msgPayload.id,
            type: 'MESSAGE',
            senderId: this.myId,
            senderName: this.myName,
            payload: msgPayload,
            timestamp: Date.now()
        };

        // Add to own UI immediately
        this.messageHistory.push(msgPayload);
        this.onMessage(msgPayload); 

        // Send out
        if (this.role === 'HOST') {
            this.broadcast(packet, this.myId);
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
                senderName: this.myName,
                payload,
                timestamp: Date.now()
            };
            target.conn.send(packet);
        }
    }

    private broadcast(packet: NetworkPacket, excludeId?: string) {
        this.participants.forEach(p => {
            if (p.id !== excludeId && p.status === 'ONLINE' && p.conn.open) {
                p.conn.send(packet);
            }
        });
    }

    private broadcastUserList() {
        if (this.role !== 'HOST') return;
        const userList = this.getPublicList();
        
        // Send SYNC_RESP with just users to everyone
        this.broadcast({
            id: uuidv4(),
            type: 'SYNC_RESP',
            senderId: this.myId,
            payload: { users: userList },
            timestamp: Date.now()
        });
        
        this.notifyUI();
    }

    // --- 5. MAINTENANCE & CLEANUP ---
    private checkHeartbeats() {
        const now = Date.now();
        let changed = false;
        
        this.participants.forEach(p => {
            // Ping logic could be added here
            if (now - p.lastPing > 15000 && p.status !== 'OFFLINE') { // 15s timeout
                p.status = 'OFFLINE';
                changed = true;
            }
        });
        
        if (changed) {
            this.notifyUI();
            if (this.role === 'HOST') this.broadcastUserList();
        }
    }

    private handleDisconnect(peerId: string) {
        const p = this.participants.get(peerId);
        if (p) {
            p.status = 'OFFLINE';
            this.notifyUI();
            if (this.role === 'HOST') this.broadcastUserList();
        }
    }

    private getPublicList() {
        const users = Array.from(this.participants.values()).map(p => ({
            id: p.id,
            name: p.name,
            status: p.status,
            isHost: p.role === 'HOST'
        }));
        // Add self
        users.unshift({ id: this.myId, name: this.myName, status: 'ONLINE', isHost: this.role === 'HOST' });
        return users;
    }

    private notifyUI() {
        this.onStateUpdate(this.getPublicList());
    }
}