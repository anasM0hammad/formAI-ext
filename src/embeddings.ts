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
        const response = await DB?.insert({
            text: data
        });
        
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
        const response = await DB?.query(data, { limit: 10 });
        if(!response) return '';

        return response;
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