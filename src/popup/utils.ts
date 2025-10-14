import { ClientOptions, OpenAI } from "openai";

export const fetchModelList = async (provider: 'OpenAI' | 'Gemini' | 'Ollama', key?: string, url?: string) => {
    const providerMapping: Record<string, ClientOptions> = {
        OpenAI: {
            apiKey: key,
            dangerouslyAllowBrowser: true 
        },
        Gemini: {
            apiKey: key,
            baseURL: `https://generativelanguage.googleapis.com/v1beta/openai/`,
            dangerouslyAllowBrowser: true 
        },
        Ollama: {
            baseURL: url || `http://localhost:11434/v1`,
            apiKey: 'dummy',
            dangerouslyAllowBrowser: true 
        }
    }

    if(!provider){
        return [];
    }

    const openai = new OpenAI(providerMapping[provider]);
    try{
        const models = await openai.models.list();
        if(models.data && models.data.length){
            return models.data.map((model) => model.id);
        }
        return [];
    }
    catch(error: any){
        throw Error(`Failed to fetch model list ${error?.message}`)
    }
}