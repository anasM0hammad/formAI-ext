const getInstallationValue = async () => {
    const result = await chrome.storage.local.get('installationValue');
    if(!result.installationValue){
        throw Error('Installation key not found, Reinstall the extension');
    }

    return new Uint8Array(result.installationValue);
}

export const encryption = async (text: string) => {
    try{
        const key = await getInstallationValue();
        const cryptoKey = await crypto.subtle.importKey(
            'raw',
            key,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt']
        );
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encoder = new TextEncoder();
        const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, cryptoKey, encoder.encode(text));
        return {
            data : Array.from(new Uint8Array(encrypted)),
            iv: Array.from(iv)
        }
    }
    catch(error: any){
        throw Error(`Encryption failed ${error.message}`);
    }
}

export const decryption = async (encrypted: { data: number[], iv: number[]}) => {
   try{
        const key = await getInstallationValue();
        const cryptoKey = await crypto.subtle.importKey(
            'raw',
            key,
            { name: 'AES-GCM', length: 256 },
            false,
            ['decrypt']
        );

        const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: new Uint8Array(encrypted.iv) },
            cryptoKey,
            new Uint8Array(encrypted.data)
        );
        
        const decoder = new TextDecoder();
        return decoder.decode(decrypted);
   }
   catch(error: any){
    throw Error(`Decryption failed ${error.message}`);
   }
}