
import React from 'react';
import { 
  LayoutGrid, 
  FileText, 
  MessageSquare, 
  Wrench,
  Activity,
  Settings
} from 'lucide-react';

export type FeatureID = 'dashboard' | 'notes' | 'chat' | 'tools' | 'settings' | 'system';

export interface Feature {
    id: FeatureID;
    name: string;
    icon: React.ReactNode;
}

export const FEATURES: Feature[] = [
    {
        id: 'dashboard',
        name: 'BERANDA',
        icon: <LayoutGrid size={22} />
    },
    {
        id: 'notes',
        name: 'CATATAN',
        icon: <FileText size={22} />
    },
    {
        id: 'chat',
        name: 'ASISTEN',
        icon: <MessageSquare size={22} />
    },
    {
        id: 'tools',
        name: 'ALAT',
        icon: <Wrench size={22} />
    },
    {
        id: 'system',
        name: 'SISTEM',
        icon: <Activity size={22} />
    }
];
