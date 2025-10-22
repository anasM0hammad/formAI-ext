import { EntityDB } from "@babycommando/entity-db";

const DB_NAME = 'formAI-database';
let DB: EntityDB | null = null;

export const initDB = () => {
    if(DB){
        return; 
    }

    try{
        const db = new EntityDB({
            vectorPath: DB_NAME,
            model: 'Xenova/all-MiniLM-L6-v2'
        });
        DB = db;
    }
    catch(error: any){
        throw Error(`Failed to initialize db ${error.message}`);
    }
}

export const insert = async (data: string) => {
    if(!DB){
        initDB();
    }

    try{
        if(data.length <= 50){
            await DB?.insert({
                text: data
            });
        }
        else{
            let chunk = 0;
            let i = 0;
            while(chunk < Math.ceil(data.length / 50)){
                const str = data.slice(i, 50+i);
                await DB?.insert({ text: str });
                i += 50;
                chunk++;
            }
        }
    }
    catch(error: any){
        throw Error(`Failed to insert in db ${error.message}`);
    }
}

export const query = async (data: string) => {
    if(!DB){
        initDB();
    }

    try{
        const response = await DB?.query(data as string, { limit: 10 });
        if(!response) return '';

        let responseText = '';
        for(const vector of response){
            responseText += ` ${vector.text}`;
        }
        return responseText;
    }
    catch(error: any){
        throw Error(`Query failed ${error.message}`);
    }
}

export const deleteVector = async () => {
    const deleteRequest = indexedDB.deleteDatabase('EntityDB');

    deleteRequest.onsuccess = function() {
        DB = null;
        console.log('database deleted successfully');
    }

    deleteRequest.onerror = function() {
        console.log('database deletion failed');
    }
}