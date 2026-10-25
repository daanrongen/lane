// Something agents run on, such as an Ollama server and what it has loaded.
export interface LoadedModel {
  readonly name: string;
  readonly bytes: number;
  readonly vram?: number;
  // Epoch ms when it unloads.
  readonly expiresAt?: number;
}

export interface Runtime {
  readonly id: string;
  // The provider name agents report: "ollama".
  readonly kind: string;
  readonly name: string;
  readonly models: readonly LoadedModel[];
}
