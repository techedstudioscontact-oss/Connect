/**
 * Nova's Agentic Action System
 */

export interface NovaAction {
    type: string;
    params: string[];
}

export class NovaAgent {
    static parseAction(text: string): NovaAction | null {
        const actionRegex = /\[ACTION:\s*(\w+)\s*(?:\|\s*([^\]]+))?\]/i;
        const match = text.match(actionRegex);

        if (!match) return null;

        const type = match[1].toLowerCase();
        const paramsStr = match[2] || '';
        const params = paramsStr.split('|').map(p => p.trim()).filter(Boolean);

        return { type, params };
    }

    static async executeAction(action: NovaAction): Promise<{ success: boolean; message: string }> {
        console.log(`[NovaAgent] Executing action:`, action);
        
        switch (action.type) {
            case 'open':
            case 'url':
                return this.openUrl(action.params[0]);
            case 'search':
            case 'google':
                return this.searchGoogle(action.params.join(' '));
            case 'youtube':
                return this.openYoutube(action.params.join(' '));
            default:
                return { success: false, message: `Unknown action: ${action.type}` };
        }
    }

    private static openUrl(url: string) {
        let target = url;
        if (!url.startsWith('http')) target = `https://${url}`;
        window.open(target, '_blank');
        return { success: true, message: `Opened ${url}` };
    }

    private static searchGoogle(query: string) {
        const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
        window.open(url, '_blank');
        return { success: true, message: `Searching Google for: ${query}` };
    }

    private static openYoutube(query: string) {
        const url = query 
            ? `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`
            : `https://www.youtube.com`;
        window.open(url, '_blank');
        return { success: true, message: `Opening YouTube` };
    }
}
