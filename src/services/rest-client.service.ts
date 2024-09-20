import "@abraham/reflection";
import { autoInjectable } from "tsyringe";
import { TokenService } from "./token.service";

autoInjectable();
export class RestClient {
  async get(path: string): Promise<Response> {
    return fetch(path, {
      method: "GET",
      headers: await this.getHeaders(),
    });
  }

  async post<T>(path: string, body: T): Promise<Response> {
    return fetch(path, {
      method: "POST",
      headers: await this.getHeaders(),
      body: JSON.stringify(body),
    });
  }

  private async getHeaders() {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${await TokenService.getToken()}`,
      accept: "accept: text/plain",
    };
  }
}
