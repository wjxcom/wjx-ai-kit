export declare const PUSH_FORMAT_GUIDE: {
    overview: string;
    configuration: {
        method: string;
        fields: {
            push_url: string;
            is_encrypt: string;
            push_custom_params: string;
        };
    };
    payload: {
        content_type: string;
        fields: {
            vid: string;
            jid: string;
            submitdata: string;
            submittime: string;
            source: string;
            ip: string;
            remark: string;
            custom_params: string;
        };
        submitdata_format: string;
    };
    encryption: {
        algorithm: string;
        key_derivation: string;
        padding: string;
        iv: string;
        encoding: string;
        decryption_steps: string[];
    };
    signature: {
        method: string;
        formula: string;
        header: string;
        verification_steps: string[];
    };
    tools: {
        decrypt_note: string;
        get_survey_settings: string;
        update_survey_settings: string;
    };
};
