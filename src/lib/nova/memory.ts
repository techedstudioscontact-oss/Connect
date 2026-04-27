/**
 * Nova's Neural Memory System
 * Adapted from Aiko's memory logic for the Connect Project
 */

export interface NovaMemoryState {
    relationship: {
        level: number;
        points: number;
        lastInteraction: string;
        firstMeet: string;
    };
    mood: {
        current: string;
        dailyBase: string;
        lastUpdated: string;
    };
    facts: string[];
    userMood: string;
}

export class NovaMemory {
    private static STORAGE_KEY = 'nova_neural_memory';

    static getMemory(): NovaMemoryState {
        const data = localStorage.getItem(this.STORAGE_KEY);
        if (data) return JSON.parse(data);

        // Initialize new memory
        const newMemory: NovaMemoryState = {
            relationship: {
                level: 1,
                points: 0,
                lastInteraction: new Date().toISOString(),
                firstMeet: new Date().toISOString()
            },
            mood: {
                current: 'happy',
                dailyBase: 'happy',
                lastUpdated: new Date().toISOString()
            },
            facts: [],
            userMood: 'neutral'
        };
        this.saveMemory(newMemory);
        return newMemory;
    }

    static saveMemory(memory: NovaMemoryState) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(memory));
    }

    static addPoints(points: number) {
        const mem = this.getMemory();
        mem.relationship.points += points;
        
        // Level up logic (logarithmic-ish)
        const nextLevelPoints = Math.pow(mem.relationship.level, 2) * 50;
        if (mem.relationship.points >= nextLevelPoints) {
            mem.relationship.level++;
        }
        
        mem.relationship.lastInteraction = new Date().toISOString();
        this.saveMemory(mem);
    }

    static updateMood(mood: string) {
        const mem = this.getMemory();
        mem.mood.current = mood;
        mem.mood.lastUpdated = new Date().toISOString();
        this.saveMemory(mem);
    }

    static addFact(fact: string) {
        const mem = this.getMemory();
        if (!mem.facts.includes(fact)) {
            mem.facts.push(fact);
            this.saveMemory(mem);
        }
    }

    static getRelationshipName(level: number): string {
        if (level <= 1) return 'Stranger';
        if (level <= 3) return 'Acquaintance';
        if (level <= 5) return 'Friend';
        if (level <= 8) return 'Close Friend';
        if (level <= 11) return 'Best Friend';
        if (level <= 14) return 'Deep Bond';
        return 'Soulmate';
    }
}
