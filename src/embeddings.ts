import { EntityDB } from "@babycommando/entity-db";

const DB_NAME = 'formAI-database';
let DB: EntityDB | null = null;

export const initDB = () => {
    if(DB) {
        return;
    }

    try {
        const db = new EntityDB({
            vectorPath: DB_NAME,
            model: 'Xenova/all-MiniLM-L6-v2'
        });
        DB = db;
    } catch(error: any) {
        throw Error(`Failed to initialize db ${error.message}`);
    }
}

export const insert = async (data: string) => {
    if(!DB) {
        initDB();
    }

    try {
        // For short inputs (under 200 chars), store as a single document
        if(data.length <= 200) {
            const trimmed = data.trim();
            if(trimmed.length > 0) {
                await DB?.insert({ text: trimmed });
            }
        } else {
            // Split on sentence boundaries for better embedding quality
            const sentences = data.match(/[^.!?\n]+[.!?\n]*/g) || [data];
            for(const sentence of sentences) {
                const trimmed = sentence.trim();
                if(trimmed.length > 0) {
                    await DB?.insert({ text: trimmed });
                }
            }
        }
    } catch(error: any) {
        throw Error(`Failed to insert in db ${error.message}`);
    }
}

export const query = async (data: string) => {
    if(!DB) {
        initDB();
    }

    try {
        const response = await DB?.query(data as string, { limit: 10 });
        if(!response) return '';

        let responseText = '';
        for(const vector of response) {
            responseText += ` ${vector.text}`;
        }
        return responseText;
    } catch(error: any) {
        throw Error(`Query failed ${error.message}`);
    }
}

export const deleteVector = (): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
        const req = indexedDB.deleteDatabase('EntityDB');
        req.onsuccess = () => {
            DB = null;
            resolve();
        };
        req.onerror = () => {
            reject(new Error('Failed to delete database'));
        };
    });
}
