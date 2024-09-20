import '@abraham/reflection';
import { autoInjectable } from 'tsyringe';

autoInjectable()
export class TokenService {
    static async saveToken(token: string) {
        await figma.clientStorage.setAsync("token", token);
    }

    static async getToken() {
        const token = await figma.clientStorage.getAsync("token");
        if (!token) return undefined;

        return token;
    }

    static async postTokenToUi() {
        const token = await TokenService.getToken();
        if (!token) return;
        figma.ui.postMessage({ type: "announce-token", token });
    }
}